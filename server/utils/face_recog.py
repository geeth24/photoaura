import io
import os
import random
import threading
import uuid

import numpy as np
import requests
from PIL import Image, ImageOps
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from config import settings
from services.aws_service import s3_client
from db.base import session_scope
from db.models import FaceData, FaceEmbedding, PhotoFaceLink, FileMetadata, Album
from utils.utils import original_key
from services.smart_gallery import store_photo_scores

AWS_BUCKET = settings.AWS_BUCKET

# InsightFace embedding service (GPU pod on max). Internal cluster DNS.
FACE_SERVICE_URL = os.environ.get("FACE_SERVICE_URL", "http://photoaura-faces:8000")

# cosine distance (1 - similarity) on L2-normalized ArcFace vectors.
# <= MATCH_DIST -> same person; the band up to SUGGEST_DIST is "maybe same".
# 0.44 sits in the valley: ~all true matches cluster < 0.40, different people
# start ~0.55+. The old 0.60 merged distinct people (e.g. a 0.587 false match).
# Used only for the LIVE incremental tag; recluster_faces() is authoritative.
MATCH_DIST = float(os.environ.get("FACE_MATCH_DIST", "0.44"))     # sim >= 0.56
SUGGEST_DIST = float(os.environ.get("FACE_SUGGEST_DIST", "0.60"))  # review band

# Chinese Whispers edge threshold: two faces are graph-connected when their
# cosine distance is <= this. Graph + majority-vote clustering avoids the
# single-link chaining that incremental matching suffers. dlib/InsightFace use
# ~0.45-0.48; our distribution puts the valley at ~0.44.
CLUSTER_DIST = float(os.environ.get("FACE_CLUSTER_DIST", "0.45"))
CLUSTER_KNN = int(os.environ.get("FACE_CLUSTER_KNN", "20"))

# Stage 2: merge clusters whose AVERAGED identity vectors nearly coincide. ArcFace
# embeds the same person's frontal vs profile shots far apart, so one person can
# split into pose sub-clusters; but their centroids land close (<=0.26 measured),
# while different people's centroids stay >=0.57 apart. 0.40 is the safe gap —
# reunites pose-split people without merging distinct ones.
CENTROID_MERGE_DIST = float(os.environ.get("FACE_CENTROID_MERGE_DIST", "0.40"))

# A face TAGS its photo (shows up when you filter by that person) unless it's
# background: tiny, or well under the size of the photo's main faces. Measured
# against the other faces rather than the frame, so a full-length group portrait
# where every face is ~3% of the width still tags everyone in it.
TAG_REL_MIN = float(os.environ.get("FACE_TAG_REL_MIN", "0.35"))
TAG_MIN_PX = int(os.environ.get("FACE_TAG_MIN_PX", "60"))


def _box_px(bbox):
    if not bbox:
        return 0
    return min(bbox[2] - bbox[0], bbox[3] - bbox[1])


def _is_subject(bbox, biggest_px):
    if not bbox:
        return True  # no box -> don't drop it
    px = _box_px(bbox)
    return px >= TAG_MIN_PX and px >= TAG_REL_MIN * biggest_px

# Gates, loosest to strictest:
#  - INDEX: is it a face at all? Drops only the clear junk; turned heads and
#    soft frames still pass so they can tag their photos.
#  - CORE: clear enough to say who someone is. Only these build people, so
#    ears, hands and blobs that slip through can't form "people" of their own;
#    the rest join a person on a confident vote, or stay unassigned.
#  - CHIP: good enough to be the thumbnail, and the bar for minting a new
#    person from a single upload.
# Faces stored before the face service sent quality signals use the old rules
# until their album is re-detected.
INDEX_DET_MIN = float(os.environ.get("FACE_INDEX_DET_MIN", "0.60"))
INDEX_SHARP_MIN = float(os.environ.get("FACE_INDEX_SHARP_MIN", "18"))  # old rows only
INDEX_MIN_PX = int(os.environ.get("FACE_INDEX_MIN_PX", "55"))

# the detector's 5 points vs the 106-point mesh, as a share of face size:
# frontal faces and profiles sit under ~0.21, ears and backs of heads run higher
JUNK_AGREE = float(os.environ.get("FACE_JUNK_AGREE", "0.30"))
JUNK_NORM = float(os.environ.get("FACE_JUNK_NORM", "13"))
JUNK_BLUR = float(os.environ.get("FACE_JUNK_BLUR", "8"))  # mush; soft faces stay, non-core

CORE_AGREE = float(os.environ.get("FACE_CORE_AGREE", "0.10"))
CORE_YAW_MAX = float(os.environ.get("FACE_CORE_YAW_MAX", "45"))
CORE_PITCH_MAX = float(os.environ.get("FACE_CORE_PITCH_MAX", "30"))
CORE_BLUR = float(os.environ.get("FACE_CORE_BLUR", "25"))
CORE_NORM = float(os.environ.get("FACE_CORE_NORM", "16"))
CORE_MIN_PX = int(os.environ.get("FACE_CORE_MIN_PX", "64"))

CHIP_DET_MIN = float(os.environ.get("FACE_DET_MIN", "0.65"))
CHIP_YAW_MAX = float(os.environ.get("FACE_YAW_MAX", "30"))
CHIP_PITCH_MAX = float(os.environ.get("FACE_PITCH_MAX", "24"))
CHIP_MIN_PX = int(os.environ.get("FACE_MIN_PX", "90"))
CHIP_SHARP_MIN = float(os.environ.get("FACE_SHARP_MIN", "120"))  # old rows only
# stricter bar once the expression signals exist
CHIP2_DET_MIN = float(os.environ.get("FACE_CHIP_DET_MIN", "0.75"))
CHIP2_YAW_MAX = float(os.environ.get("FACE_CHIP_YAW_MAX", "20"))
CHIP2_PITCH_MAX = float(os.environ.get("FACE_CHIP_PITCH_MAX", "20"))
CHIP2_ROLL_MAX = float(os.environ.get("FACE_CHIP_ROLL_MAX", "25"))
CHIP2_MIN_PX = int(os.environ.get("FACE_CHIP_MIN_PX", "110"))
CHIP2_BLUR = float(os.environ.get("FACE_CHIP_BLUR", "40"))
CHIP2_EYES_MIN = float(os.environ.get("FACE_CHIP_EYES_MIN", "0.22"))
CHIP2_GAZE_MAX = float(os.environ.get("FACE_CHIP_GAZE_MAX", "0.06"))
# a crop this much covered by another face shows someone else: a head in
# front, or the person cheek to cheek beside them
CHIP_CROWD_MAX = float(os.environ.get("FACE_CHIP_CROWD_MAX", "0.10"))
CROWD_PENALTY = 60.0

# a non-core face joins a person when its 3 closest faces there average this
# similarity and beat the runner-up person by the margin. With fewer than 3
# faces to vote, the bar is the old single-match one.
ATTACH_SIM = float(os.environ.get("FACE_ATTACH_SIM", "0.45"))
ATTACH_SIM_FEW = float(os.environ.get("FACE_ATTACH_SIM_FEW", "0.56"))
ATTACH_MARGIN = float(os.environ.get("FACE_ATTACH_MARGIN", "0.08"))

# keep the current thumbnail unless a new pick beats it by this much, so
# near-identical burst frames don't swap the chip (and its URL) every upload
CHIP_STICKY = float(os.environ.get("FACE_CHIP_STICKY", "5"))

# faces scored with the expression signals outrank ones stored before them
# (the old score topped out ~195) until every album is re-detected
SCORED_BASE = 200.0

# key_score sentinel for a manually pinned cover. Far above any auto face_score,
# so neither incremental tagging nor recluster ever overwrites it.
COVER_LOCK = 1_000_000.0

# per-face signals kept alongside the box in face_embedding.pose
SIGNALS = (
    "yaw", "pitch", "roll", "sharpness", "eye_open",
    "blur", "emb_norm", "landmark_agreement", "smile", "gaze", "kps",
)


def _embed_image(bucket, key):
    """Ask the GPU service for every face's bbox + 512-d embedding."""
    resp = requests.post(
        f"{FACE_SERVICE_URL}/embed",
        json={"bucket": bucket, "key": key},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def _min_px(face):
    x1, y1, x2, y2 = face["bbox"]
    return min(x2 - x1, y2 - y1)


def _has_signals(face):
    return face.get("landmark_agreement") is not None and face.get("blur") is not None


def crowd_of(box, others, pad=0.2):
    """Share of this face's thumbnail crop (the box padded like _crop) that the
    most overlapping other face in the photo covers."""
    if not box:
        return 0.0
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    px1, py1, px2, py2 = x1 - w * pad, y1 - h * pad, x2 + w * pad, y2 + h * pad
    area = (px2 - px1) * (py2 - py1)
    if area <= 0:
        return 0.0
    worst = 0.0
    for o in others:
        if not o:
            continue
        ix = min(px2, o[2]) - max(px1, o[0])
        iy = min(py2, o[3]) - max(py1, o[1])
        if ix > 0 and iy > 0:
            worst = max(worst, ix * iy / area)
    return worst


def _crowds(faces_boxes):
    """crowd_of for each (id, box) against the rest of its photo's boxes."""
    out = {}
    for i, (fid, box) in enumerate(faces_boxes):
        out[fid] = crowd_of(box, [b for j, (_, b) in enumerate(faces_boxes) if j != i])
    return out


def _pose_of(face):
    return {k: face.get(k) for k in SIGNALS}


def should_index(face):
    """Is this worth embedding and keeping at all? Returns (ok, reason)."""
    if (face.get("det_score") or 0) < INDEX_DET_MIN:
        return False, "low confidence"
    if _min_px(face) < INDEX_MIN_PX:
        return False, "too small"
    if _has_signals(face):
        if face["landmark_agreement"] > JUNK_AGREE:
            return False, "not a face"
        if (face.get("emb_norm") or JUNK_NORM) < JUNK_NORM:
            return False, "not a face"
        if face["blur"] < JUNK_BLUR:
            return False, "mush"
        return True, ""
    sharp = face.get("sharpness")
    if sharp is not None and sharp < INDEX_SHARP_MIN:
        return False, "garbage blur"
    return True, ""


def is_core(face):
    """Clear enough to define who someone is. Old rows all count, as they did
    before the signals existed."""
    if not _has_signals(face):
        return True
    if abs(face.get("yaw") or 0) > CORE_YAW_MAX:
        return False
    if abs(face.get("pitch") or 0) > CORE_PITCH_MAX:
        return False
    if _min_px(face) < CORE_MIN_PX:
        return False
    return (
        face["landmark_agreement"] <= CORE_AGREE
        and face["blur"] >= CORE_BLUR
        and (face.get("emb_norm") or CORE_NORM) >= CORE_NORM
    )


def is_chip_worthy(face):
    """Strict: fit to be a person's thumbnail, and the only kind allowed to
    spawn a brand-new person during an upload."""
    if _has_signals(face):
        return (
            is_core(face)
            and (face.get("det_score") or 0) >= CHIP2_DET_MIN
            and abs(face.get("yaw") or 0) <= CHIP2_YAW_MAX
            and abs(face.get("pitch") or 0) <= CHIP2_PITCH_MAX
            and abs(face.get("roll") or 0) <= CHIP2_ROLL_MAX
            and _min_px(face) >= CHIP2_MIN_PX
            and face["blur"] >= CHIP2_BLUR
            and (face.get("eye_open") or 0) >= CHIP2_EYES_MIN
            and (face.get("gaze") or 0) <= CHIP2_GAZE_MAX
        )
    if (face.get("det_score") or 0) < CHIP_DET_MIN:
        return False
    if abs(face.get("yaw") or 0) > CHIP_YAW_MAX:
        return False
    if abs(face.get("pitch") or 0) > CHIP_PITCH_MAX:
        return False
    if _min_px(face) < CHIP_MIN_PX:
        return False
    sharp = face.get("sharpness")
    if sharp is not None and sharp < CHIP_SHARP_MIN:
        return False
    return True


def _clear_of_others(face):
    """No other face covers much of this one's thumbnail crop."""
    return (face.get("crowd") or 0) <= CHIP_CROWD_MAX


def face_score(face, typical=None):
    """Higher = better key photo. With expression signals: a smile counts most,
    then facing the camera, focus, size, open eyes and looking into the lens,
    plus how typical the face is of the person (typical = similarity to their
    average face)."""
    yaw, pitch, roll = (
        abs(face.get("yaw") or 0),
        abs(face.get("pitch") or 0),
        abs(face.get("roll") or 0),
    )
    if _has_signals(face):
        frontal = max(0.0, 1.0 - yaw / 25 - pitch / 25 - roll / 40)
        sharp = min(face["blur"], 120) / 120
        size = min(_min_px(face), 300) / 300
        eo = face.get("eye_open")
        eyes = 1.0 if eo is None else float(np.clip((eo - 0.20) / 0.12, 0, 1))
        gz = face.get("gaze")
        look = 1.0 if gz is None else float(np.clip(1 - gz / CHIP2_GAZE_MAX, 0, 1))
        smile = face.get("smile") or 0.0
        typ = 0.7 if typical is None else typical
        return SCORED_BASE + (
            30 * smile + 20 * frontal + 15 * sharp + 10 * size
            + 10 * eyes + 5 * look + 10 * typ
        ) - CROWD_PENALTY * (face.get("crowd") or 0)

    # old rows: facing the camera dominates; size is capped so a big
    # looking-away close-up can't beat a smaller head-on shot
    x1, y1, x2, y2 = face["bbox"]
    area = max(0, x2 - x1) * max(0, y2 - y1)
    frontal = max(0.0, 1.0 - yaw / 40 - pitch / 25 - roll / 60)
    size = min(area, 60000) / 60000
    sharp = min(face.get("sharpness") or 0, 400) / 400
    eo = face.get("eye_open")
    eyes = 1.0 if eo is None else max(0.0, min(1.0, (eo - 0.15) / 0.20))
    return (
        frontal * 100 + size * 25 + sharp * 20
        + (face.get("det_score") or 0) * 15 + eyes * 35
        - CROWD_PENALTY * (face.get("crowd") or 0)
    )


def _match_person(session, embedding):
    """Nearest existing person by cosine distance, or None if nobody's close."""
    row = (
        session.query(
            FaceEmbedding.face_id,
            FaceEmbedding.embedding.cosine_distance(embedding).label("dist"),
        )
        .filter(FaceEmbedding.face_id.isnot(None))
        .order_by("dist")
        .limit(1)
        .first()
    )
    if row and row.dist is not None and row.dist <= MATCH_DIST:
        return row.face_id
    return None


def _crop(img, bbox, pad=0.2):
    x1, y1, x2, y2 = bbox
    w, h = x2 - x1, y2 - y1
    left = max(0, int(x1 - w * pad))
    top = max(0, int(y1 - h * pad))
    right = min(img.width, int(x2 + w * pad))
    bottom = min(img.height, int(y2 + h * pad))
    return img.crop((left, top, right, bottom))


def chip_key_of(fd):
    """S3 key of a person's chip. Rows from before versioned chips point at
    the old fixed key."""
    return fd.chip_key or f"faces/{fd.external_id}.jpg"


def chip_url(fd, fit=None):
    prefix = f"fit-in/{fit}/" if fit else ""
    return f"https://{settings.AWS_CLOUDFRONT_URL}/{prefix}{chip_key_of(fd)}"


def _new_chip_key(external_id, embedding_id):
    # a new URL per chip: the CDN and the apps cache chips for a year, so
    # overwriting one key kept showing the old face
    return f"faces/{external_id}-{embedding_id}.jpg"


def _upload_chip(img, bbox, key, bucket=AWS_BUCKET):
    buf = io.BytesIO()
    _crop(img, bbox).save(buf, format="JPEG")
    buf.seek(0)
    s3_client.upload_fileobj(
        buf, bucket, key, ExtraArgs={"ContentType": "image/jpeg"}
    )


def delete_chips(keys, bucket=AWS_BUCKET):
    keys = sorted({k for k in keys if k})
    for i in range(0, len(keys), 1000):
        try:
            s3_client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": k} for k in keys[i:i + 1000]]},
            )
        except Exception as e:
            print(f"chip cleanup failed: {e}")


def set_person_cover(face_id, album_slug, filename):
    """Pin a person's cover chip to their face in a chosen photo. Crops that
    face to a new chip key and locks key_score so auto-scoring never overrides
    it. Returns (ok, message)."""
    with session_scope() as session:
        person = session.query(FaceData).filter_by(external_id=face_id).first()
        if not person:
            return False, "Person not found"

        photo = (
            session.query(FileMetadata)
            .join(Album, Album.id == FileMetadata.album_id)
            .filter(Album.slug == album_slug, FileMetadata.filename == filename)
            .first()
        )
        if not photo:
            return False, "Photo not found"

        fe = (
            session.query(FaceEmbedding)
            .filter_by(face_id=face_id, photo_id=photo.id)
            .first()
        )
        if not fe or not (fe.bbox or {}).get("box"):
            return False, "This person doesn't appear in that photo"

        # face boxes are in the original's pixels, not the smaller proof's
        album = session.query(Album).filter_by(slug=album_slug).first()
        key = original_key(album_slug, photo, album.hold_token if album else None)
        img = ImageOps.exif_transpose(
            Image.open(io.BytesIO(s3_client.get_object(Bucket=AWS_BUCKET, Key=key)["Body"].read()))
        ).convert("RGB")
        old_chip = chip_key_of(person)
        new_chip = _new_chip_key(face_id, fe.id)
        _upload_chip(img, fe.bbox["box"], new_chip)
        person.key_score = COVER_LOCK
        person.key_embedding_id = fe.id
        person.chip_key = new_chip
        session.commit()
    if old_chip != new_chip:
        delete_chips([old_chip])
    return True, "Cover updated"


def detect_and_store_faces(file_path, photo_id, album_id, bucket):
    result = _embed_image(bucket, file_path)
    if result.get("photo"):
        with session_scope() as session:
            store_photo_scores(session, photo_id, album_id, result["photo"])
    faces = result.get("faces", [])
    if not faces:
        return "No faces detected."
    for fid, value in _crowds([(i, f.get("bbox")) for i, f in enumerate(faces)]).items():
        faces[fid]["crowd"] = value

    # one image fetch for the key-face crops
    img = ImageOps.exif_transpose(
        Image.open(io.BytesIO(s3_client.get_object(Bucket=bucket, Key=file_path)["Body"].read()))
    ).convert("RGB")

    # the photo's main faces set the bar for what counts as background
    biggest = max((_min_px(f) for f in faces if should_index(f)[0]), default=0)
    replaced_chips = []

    with session_scope() as session:
        for index, face in enumerate(faces):
            ok, reason = should_index(face)
            if not ok:
                print(f"skip face {index + 1} in {file_path}: {reason}")
                continue

            embedding = face["embedding"]
            match = _match_person(session, embedding)
            chip_worthy = is_chip_worthy(face)

            # a weak crop that matches nobody YET is parked unassigned (no link)
            # rather than dropped — a person's frontal anchor may only be
            # processed later. assign_pending_faces() claims it afterward.
            # we still never MINT a new person from a sub-par crop (junk tiles).
            if match is None and not chip_worthy:
                session.add(
                    FaceEmbedding(
                        photo_id=photo_id,
                        album_id=album_id,
                        face_id=None,
                        embedding=embedding,
                        det_score=face.get("det_score"),
                        bbox={"box": face["bbox"]},
                        pose=_pose_of(face),
                    )
                )
                session.commit()
                continue
            face_id = match or uuid.uuid4().hex

            # only frontal/sharp crops compete to be the person's key chip;
            # turned/soft shots still get linked, just never shown as the face
            score = face_score(face) if chip_worthy else None
            if chip_worthy:
                session.execute(
                    pg_insert(FaceData)
                    .values(external_id=face_id, key_score=score)
                    .on_conflict_do_update(
                        index_elements=["external_id"],
                        set_={"key_score": score},
                        where=(FaceData.key_score.is_(None))
                        | (FaceData.key_score < score),
                    )
                )
                session.flush()

            fe = FaceEmbedding(
                photo_id=photo_id,
                album_id=album_id,
                face_id=face_id,
                embedding=embedding,
                det_score=face.get("det_score"),
                bbox={"box": face["bbox"]},
                pose=_pose_of(face),
            )
            session.add(fe)
            session.flush()

            if chip_worthy:
                # the upsert ran as raw SQL; reload so key_score isn't a cached value
                fd = (
                    session.query(FaceData)
                    .filter_by(external_id=face_id)
                    .populate_existing()
                    .first()
                )
                if fd and fd.key_score == score:
                    new_chip = _new_chip_key(face_id, fe.id)
                    _upload_chip(img, face["bbox"], new_chip, bucket)
                    replaced_chips.append(chip_key_of(fd))
                    fd.chip_key = new_chip
                    fd.key_embedding_id = fe.id

            if _is_subject(face["bbox"], biggest):
                session.add(
                    PhotoFaceLink(photo_id=photo_id, face_id=face_id, album_id=album_id)
                )
            session.commit()

    delete_chips(replaced_chips, bucket)
    return "Faces processed and stored."


def assign_pending_faces(album_id=None):
    """Second pass: claim parked (unassigned) embeddings now that every person
    cluster exists. Order-independent — fixes turned shots processed before
    their person's frontal anchor. Pass album_id to scope to one album."""
    with session_scope() as session:
        q = session.query(FaceEmbedding).filter(FaceEmbedding.face_id.is_(None))
        if album_id is not None:
            q = q.filter(FaceEmbedding.album_id == album_id)
        pending = q.all()

        claimed = 0
        for fe in pending:
            match = _match_person(session, fe.embedding)
            if not match:
                continue
            fe.face_id = match
            session.add(
                PhotoFaceLink(
                    photo_id=fe.photo_id, face_id=match, album_id=fe.album_id
                )
            )
            claimed += 1
        session.commit()
    print(f"assign_pending_faces: claimed {claimed}/{len(pending)} parked faces")
    return claimed


def _unit(v):
    v = np.asarray(v, dtype=float)
    n = np.linalg.norm(v)
    return v / n if n else v


def _stored_face(fe, crowd=0.0):
    """Rebuild a face dict (for the gates and face_score) from a stored row."""
    p = fe.pose or {}
    return {
        "bbox": (fe.bbox or {}).get("box"),
        "det_score": fe.det_score,
        "crowd": crowd,
        **{k: p.get(k) for k in SIGNALS},
    }


def _chinese_whispers(node_ids, adjacency, iterations=25):
    """Graph clustering by iterative majority vote (Fei 2007). Each node adopts
    the label with the highest summed edge weight among its neighbours. Robust
    to single-link chaining because one weak edge can't outvote a real cluster.
    Returns {node_id: label}."""
    labels = {n: n for n in node_ids}
    rng = random.Random(1)  # fixed seed -> reproducible reclusters
    for _ in range(iterations):
        order = list(node_ids)
        rng.shuffle(order)
        changed = 0
        for n in order:
            scores = {}
            for nb, w in adjacency.get(n, ()):
                lbl = labels[nb]
                scores[lbl] = scores.get(lbl, 0.0) + w
            if not scores:
                continue
            best = max(scores, key=scores.get)
            if labels[n] != best:
                labels[n] = best
                changed += 1
        if changed == 0:
            break
    return labels


def _plan_people(clusters, by_id, keep=frozenset(), current=frozenset(), crowd=None):
    """Turn clusters of core faces into people. A cluster becomes a person when
    one of its faces is chip-worthy, when two or more clean faces agree, or when
    it holds a face in `keep` (admin merges, pinned covers). Faces stored
    before the quality signals can't vouch for each other, since ears and
    blobs passed as clean back then. Its thumbnail is the best-scoring
    chip-worthy face, else the best face it has, but a face in `current`
    (today's thumbnails) stays unless beaten by CHIP_STICKY. Returns
    ([(member_ids, chip_face_id)] biggest first, leftover face ids)."""
    kept, leftovers = [], []
    for members in sorted(clusters.values(), key=len, reverse=True):
        stored = {i: _stored_face(by_id[i], (crowd or {}).get(i, 0.0)) for i in members}
        worthy = [i for i in members if is_chip_worthy(stored[i])]
        vouched = sum(_has_signals(stored[i]) for i in members) >= 2
        if not (worthy or vouched or any(i in keep for i in members)):
            leftovers.extend(members)
            continue
        vecs = {i: _unit(by_id[i].embedding) for i in members}
        centre = _unit(np.mean(list(vecs.values()), axis=0))
        # a face half behind someone else still makes the person, just not the thumbnail
        pool = [i for i in worthy if _clear_of_others(stored[i])] or worthy or members
        scores = {i: face_score(stored[i], float(vecs[i] @ centre)) for i in pool}
        best = max(pool, key=scores.get)
        held = [i for i in pool if i in current]
        if held and scores[best] - scores[held[0]] < CHIP_STICKY:
            best = held[0]
        kept.append((list(members), best))
    return kept, leftovers


def _attach(face_ids, kept, by_id):
    """Give each face to the person whose closest faces it matches best: their
    top 3 must average ATTACH_SIM (ATTACH_SIM_FEW for people with fewer than 3
    faces) and beat every other person by ATTACH_MARGIN. If that best person is
    already in the photo, the face is someone else and joins nobody. Extends
    kept's member lists; returns how many faces joined someone."""
    if not kept or not face_ids:
        return 0
    people = [np.array([_unit(by_id[i].embedding) for i in m]) for m, _ in kept]
    few = np.array([len(m) < 3 for m, _ in kept])
    in_photo = [{by_id[i].photo_id for i in m} for m, _ in kept]
    picks = []
    # chunked so a big library never builds one huge similarity matrix
    for start in range(0, len(face_ids), 500):
        chunk = face_ids[start:start + 500]
        X = np.array([_unit(by_id[i].embedding) for i in chunk])
        S = np.empty((len(chunk), len(people)))
        for k, V in enumerate(people):
            sims = X @ V.T
            t = min(3, sims.shape[1])
            S[:, k] = np.partition(sims, -t, axis=1)[:, -t:].mean(axis=1)
        for row, i in enumerate(chunk):
            order = np.argsort(S[row])[::-1]
            best = float(S[row, order[0]])
            runner_up = float(S[row, order[1]]) if len(order) > 1 else 0.0
            bar = ATTACH_SIM_FEW if few[order[0]] else ATTACH_SIM
            if best >= bar and best - runner_up >= ATTACH_MARGIN:
                picks.append((best, i, int(order[0])))

    joined = 0
    # most confident first, so a photo's clearest match claims the person
    for _, i, k in sorted(picks, key=lambda t: -t[0]):
        photo = by_id[i].photo_id
        if photo in in_photo[k]:
            continue
        kept[k][0].append(i)
        in_photo[k].add(photo)
        joined += 1
    return joined


def _join_manual_groups(labels, faces):
    """Faces an admin merged share a manual_group; put their clusters together
    no matter what the embeddings say."""
    groups = {}
    for fe in faces:
        if fe.manual_group:
            groups.setdefault(fe.manual_group, []).append(fe.id)
    if not groups:
        return labels
    parent = {}

    def _find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for ids in groups.values():
        root = _find(labels[ids[0]])
        for i in ids[1:]:
            r = _find(labels[i])
            if r != root:
                parent[r] = root
    return {fid: _find(lbl) for fid, lbl in labels.items()}


def _recrop_chips(session, jobs):
    """Crop and upload chips, one original download per photo. jobs is
    [(external_id, photo_id, embedding_id, bbox)]. Each person's row only
    points at the new chip once it's uploaded, so a failed upload keeps the
    old one and the next recluster retries."""
    by_photo = {}
    for job in jobs:
        by_photo.setdefault(job[1], []).append(job)
    done = 0
    for photo_id, photo_jobs in by_photo.items():
        row = (
            session.query(Album.slug, Album.hold_token, FileMetadata)
            .join(FileMetadata, FileMetadata.album_id == Album.id)
            .filter(FileMetadata.id == photo_id)
            .first()
        )
        if not row:
            continue
        key = original_key(row.slug, row.FileMetadata, row.hold_token)
        try:
            img = ImageOps.exif_transpose(
                Image.open(io.BytesIO(s3_client.get_object(Bucket=AWS_BUCKET, Key=key)["Body"].read()))
            ).convert("RGB")
        except Exception as e:
            print(f"recluster: couldn't read {key} for chips: {e}")
            continue
        for external_id, _, embedding_id, bbox in photo_jobs:
            new_chip = _new_chip_key(external_id, embedding_id)
            try:
                _upload_chip(img, bbox, new_chip)
            except Exception as e:
                print(f"recluster: chip upload failed for {new_chip}: {e}")
                continue
            session.query(FaceData).filter_by(external_id=external_id).update(
                {"chip_key": new_chip, "key_embedding_id": embedding_id}
            )
            done += 1
        session.commit()
    return done


_recluster_lock = threading.Lock()


def recluster_faces():
    """One recluster at a time, whoever asks (uploads, resync, revisions)."""
    with _recluster_lock:
        return _recluster_faces()


def _recluster_faces():
    """Authoritative clustering: rebuild every person from the full embedding
    graph using Chinese Whispers. Order-independent and chaining-resistant —
    unlike the incremental per-photo matcher. Keeps names, admin merges and
    pinned covers, and re-crops a chip only when its best face changed."""
    with session_scope() as session:
        faces = session.query(FaceEmbedding).all()
        if not faces:
            return "No faces to cluster."
        by_id = {fe.id: fe for fe in faces}
        node_ids = list(by_id.keys())
        by_photo = {}
        for fe in faces:
            by_photo.setdefault(fe.photo_id, []).append((fe.id, (fe.bbox or {}).get("box")))
        crowd = {}
        for boxes in by_photo.values():
            crowd.update(_crowds(boxes))
        stored = {fe.id: _stored_face(fe, crowd.get(fe.id, 0.0)) for fe in faces}

        # each photo's biggest face, the yardstick for background faces
        biggest = {}
        for fe in faces:
            px = _box_px((fe.bbox or {}).get("box"))
            if px > biggest.get(fe.photo_id, 0):
                biggest[fe.photo_id] = px

        # what each face was assigned to before — lets us keep stable person ids
        # (and names) across reruns, so re-clustering is cheap and idempotent
        old_face_of = {fe.id: fe.face_id for fe in faces}
        all_fd = session.query(FaceData).all()
        old_names = {fd.external_id: fd.name for fd in all_fd if fd.name}
        old_chip = {
            fd.external_id: (fd.key_embedding_id, chip_key_of(fd)) for fd in all_fd
        }
        old_scores = {fd.external_id: fd.key_score or 0 for fd in all_fd}
        # pinned covers follow the face they were pinned to, whichever cluster
        # it lands in. older pins have no face recorded and follow the person id
        pinned = {
            fd.key_embedding_id: chip_key_of(fd)
            for fd in all_fd
            if (fd.key_score or 0) >= COVER_LOCK and fd.key_embedding_id in by_id
        }
        old_chip_keys = {key for _, key in old_chip.values()}

        # only clean faces define people; admin merges and pins count as clean
        core = {
            i for i in node_ids
            if by_id[i].manual_group or i in pinned or is_core(stored[i])
        }

        # edges: each face's nearest neighbours within CLUSTER_DIST (HNSW kNN)
        sim_min = 1.0 - CLUSTER_DIST
        rows = session.execute(
            text(
                """
                SELECT a.id AS a, nn.id AS b,
                       1 - (a.embedding <=> nn.embedding) AS sim
                FROM face_embedding a
                CROSS JOIN LATERAL (
                    SELECT b.id, b.embedding FROM face_embedding b
                    WHERE b.id <> a.id
                    ORDER BY b.embedding <=> a.embedding
                    LIMIT :k
                ) nn
                WHERE 1 - (a.embedding <=> nn.embedding) >= :sim_min
                """
            ),
            {"k": CLUSTER_KNN, "sim_min": sim_min},
        ).fetchall()

        adjacency = {}
        for a, b, sim in rows:
            if a in core and b in core:
                adjacency.setdefault(a, []).append((b, float(sim)))
                adjacency.setdefault(b, []).append((a, float(sim)))

        labels = _chinese_whispers([i for i in node_ids if i in core], adjacency)

        # stage 2: centroid merge — reunite pose-split people (frontal vs profile)
        groups = {}
        for fid, lbl in labels.items():
            groups.setdefault(lbl, []).append(fid)
        glabels = list(groups)
        if len(glabels) > 1:
            cent = np.array([
                _unit(np.mean([by_id[i].embedding for i in groups[g]], axis=0))
                for g in glabels
            ])
            sim = cent @ cent.T
            parent = list(range(len(glabels)))

            def _find(x):
                while parent[x] != x:
                    parent[x] = parent[parent[x]]
                    x = parent[x]
                return x

            thr = 1.0 - CENTROID_MERGE_DIST
            for i in range(len(glabels)):
                for j in range(i + 1, len(glabels)):
                    if sim[i, j] >= thr:
                        parent[_find(i)] = _find(j)
            remap = {g: glabels[_find(i)] for i, g in enumerate(glabels)}
            labels = {fid: remap[lbl] for fid, lbl in labels.items()}

        # stage 3: admin merges win over the embeddings
        labels = _join_manual_groups(labels, faces)

        clusters = {}
        for fid, lbl in labels.items():
            clusters.setdefault(lbl, []).append(fid)
        keep = {fe.id for fe in faces if fe.manual_group} | set(pinned)
        current = {emb for emb, _ in old_chip.values() if emb}
        people_plan, leftovers = _plan_people(clusters, by_id, keep, current, crowd)
        # turned heads, soft frames and lone faces join someone only on a clear vote
        satellites = [i for i in node_ids if i not in core] + leftovers
        attached = _attach(satellites, people_plan, by_id)

        # wipe old identities; embeddings stay, face_id gets rewritten.
        # null the FK references before dropping face_data rows.
        # "evaluate" nulls the loaded rows too; with False, re-assigning a face
        # its old id looked unchanged and never got written back
        session.query(FaceEmbedding).update(
            {FaceEmbedding.face_id: None}, synchronize_session="evaluate"
        )
        session.query(PhotoFaceLink).delete()
        session.query(FaceData).delete()
        session.flush()

        people = 0
        links = 0
        used_ids = set()
        jobs = []  # chips to crop after commit
        # biggest clusters first so they claim their original person id
        for members, best_id in people_plan:
            best_face = _stored_face(by_id[best_id], crowd.get(best_id, 0.0))

            # reuse the person id this cluster mostly came from -> stable ids +
            # we can skip re-cropping an unchanged chip. fall back to a new id.
            # clean faces decide who this is; attached ones only tag along
            voters = [i for i in members if i in core] or members
            tally = {}
            for i in voters:
                oid = old_face_of.get(i)
                if oid:
                    tally[oid] = tally.get(oid, 0) + 1
            external_id = next(
                (oid for oid, _ in sorted(tally.items(), key=lambda kv: -kv[1])
                 if oid not in used_ids),
                None,
            ) or uuid.uuid4().hex
            used_ids.add(external_id)

            inherited = next(
                (old_names[old_face_of[i]] for i in voters
                 if old_face_of.get(i) in old_names),
                None,
            ) if old_names else None

            pin = next((i for i in members if i in pinned), None)
            prev_emb, prev_key = old_chip.get(external_id, (None, None))
            if pin is not None:
                score, key_emb, chip_key = COVER_LOCK, pin, pinned[pin]
            elif old_scores.get(external_id, 0) >= COVER_LOCK and prev_emb is None:
                score, key_emb, chip_key = COVER_LOCK, None, prev_key
            else:
                # a fallback pick mustn't keep a better upload from taking over
                score = face_score(best_face) if is_chip_worthy(best_face) else 0.0
                if prev_emb == best_id:
                    key_emb, chip_key = best_id, prev_key
                else:
                    # keep showing the old chip until the new one is uploaded
                    key_emb, chip_key = None, prev_key
                    if best_face["bbox"]:
                        jobs.append(
                            (external_id, by_id[best_id].photo_id, best_id, best_face["bbox"])
                        )

            session.add(
                FaceData(
                    external_id=external_id,
                    name=inherited,
                    key_score=score,
                    key_embedding_id=key_emb,
                    chip_key=chip_key,
                )
            )
            linked = set()
            for i in members:
                fe = by_id[i]
                fe.face_id = external_id  # cluster membership (all faces)
                # tag the photo unless this person is background in it
                if fe.photo_id not in linked and _is_subject(
                    (fe.bbox or {}).get("box"), biggest.get(fe.photo_id, 0)
                ):
                    linked.add(fe.photo_id)
                    session.add(
                        PhotoFaceLink(
                            photo_id=fe.photo_id,
                            face_id=external_id,
                            album_id=fe.album_id,
                        )
                    )
            links += len(linked)
            people += 1

        session.commit()

        recropped = _recrop_chips(session, jobs)

        # chips nobody points at any more: replaced ones and people who are gone
        in_use = {
            key or f"faces/{eid}.jpg"
            for eid, key in session.query(FaceData.external_id, FaceData.chip_key)
        }
        delete_chips(old_chip_keys - in_use)

    print(
        f"recluster_faces: {people} people from {len(node_ids)} faces "
        f"({len(core)} core, {attached}/{len(satellites)} others attached), "
        f"{links} photo links, {recropped}/{len(jobs)} chips re-cropped"
    )
    return f"{people} people"
