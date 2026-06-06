import io
import os
import random
import uuid

import numpy as np
import requests
from PIL import Image
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from config import settings
from services.aws_service import s3_client
from db.base import session_scope
from db.models import FaceData, FaceEmbedding, PhotoFaceLink, FileMetadata, Album

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

# Two gates with different jobs:
#  - INDEX: lenient. Should we embed + link this face at all? ArcFace is
#    pose-robust, so a turned/tilted face still matches the right person and
#    keeps them attached to the photo. Only drop genuine garbage.
#  - CHIP: strict. Is this crop nice enough to be a person's displayed
#    thumbnail? Frontal, sharp, big. Also the bar for SPAWNING a new person —
#    we never mint a new face from a bad crop (that's what made junk tiles).
INDEX_DET_MIN = float(os.environ.get("FACE_INDEX_DET_MIN", "0.60"))
INDEX_SHARP_MIN = float(os.environ.get("FACE_INDEX_SHARP_MIN", "18"))  # only true mush
INDEX_MIN_PX = int(os.environ.get("FACE_INDEX_MIN_PX", "55"))

CHIP_DET_MIN = float(os.environ.get("FACE_DET_MIN", "0.65"))
CHIP_YAW_MAX = float(os.environ.get("FACE_YAW_MAX", "30"))
CHIP_PITCH_MAX = float(os.environ.get("FACE_PITCH_MAX", "24"))
CHIP_MIN_PX = int(os.environ.get("FACE_MIN_PX", "90"))
CHIP_SHARP_MIN = float(os.environ.get("FACE_SHARP_MIN", "120"))


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


def should_index(face):
    """Lenient: embed + link any real face so the person stays attached to the
    photo, even at an angle. Drops only genuine garbage. Returns (ok, reason)."""
    if (face.get("det_score") or 0) < INDEX_DET_MIN:
        return False, "low confidence"
    if _min_px(face) < INDEX_MIN_PX:
        return False, "too small"
    sharp = face.get("sharpness")
    if sharp is not None and sharp < INDEX_SHARP_MIN:
        return False, "garbage blur"
    return True, ""


def is_chip_worthy(face):
    """Strict: a frontal, sharp, sizeable crop — fit to be a person's thumbnail
    and the only kind allowed to spawn a brand-new person."""
    if (face.get("det_score") or 0) < CHIP_DET_MIN:
        return False
    if abs(face.get("yaw", 0)) > CHIP_YAW_MAX:
        return False
    if abs(face.get("pitch", 0)) > CHIP_PITCH_MAX:
        return False
    if _min_px(face) < CHIP_MIN_PX:
        return False
    sharp = face.get("sharpness")
    if sharp is not None and sharp < CHIP_SHARP_MIN:
        return False
    return True


def face_score(face):
    """Higher = better key photo. Facing the camera dominates; size and detector
    confidence break ties. Size is capped so a big looking-away close-up can't
    beat a smaller head-on shot."""
    x1, y1, x2, y2 = face["bbox"]
    area = max(0, x2 - x1) * max(0, y2 - y1)
    yaw, pitch, roll = (
        abs(face.get("yaw", 0)),
        abs(face.get("pitch", 0)),
        abs(face.get("roll", 0)),
    )
    frontal = max(0.0, 1.0 - yaw / 40 - pitch / 25 - roll / 60)
    size = min(area, 60000) / 60000
    sharp = min(face.get("sharpness") or 0, 400) / 400
    return frontal * 100 + size * 25 + sharp * 20 + (face.get("det_score") or 0) * 15


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


def detect_and_store_faces(file_path, photo_id, album_id, bucket):
    result = _embed_image(bucket, file_path)
    faces = result.get("faces", [])
    if not faces:
        return "No faces detected."

    # one image fetch for the key-face crops
    img = Image.open(
        io.BytesIO(s3_client.get_object(Bucket=bucket, Key=file_path)["Body"].read())
    ).convert("RGB")

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
                        pose={
                            "yaw": face.get("yaw"),
                            "pitch": face.get("pitch"),
                            "roll": face.get("roll"),
                            "sharpness": face.get("sharpness"),
                        },
                    )
                )
                session.commit()
                continue
            face_id = match or uuid.uuid4().hex

            # only frontal/sharp crops compete to be the person's key chip;
            # turned/soft shots still get linked, just never shown as the face
            if chip_worthy:
                score = face_score(face)
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

                fd = session.query(FaceData).filter_by(external_id=face_id).first()
                if fd and fd.key_score == score:
                    buf = io.BytesIO()
                    _crop(img, face["bbox"]).save(buf, format="JPEG")
                    buf.seek(0)
                    s3_client.upload_fileobj(
                        buf,
                        bucket,
                        f"faces/{face_id}.jpg",
                        ExtraArgs={"ContentType": "image/jpeg"},
                    )

            session.add(
                FaceEmbedding(
                    photo_id=photo_id,
                    album_id=album_id,
                    face_id=face_id,
                    embedding=embedding,
                    det_score=face.get("det_score"),
                    bbox={"box": face["bbox"]},
                    pose={
                        "yaw": face.get("yaw"),
                        "pitch": face.get("pitch"),
                        "roll": face.get("roll"),
                        "sharpness": face.get("sharpness"),
                    },
                )
            )
            session.add(
                PhotoFaceLink(photo_id=photo_id, face_id=face_id, album_id=album_id)
            )
            session.commit()

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


def _stored_face(fe):
    """Rebuild a face dict (for face_score / is_chip_worthy) from a stored row."""
    p = fe.pose or {}
    return {
        "bbox": (fe.bbox or {}).get("box"),
        "det_score": fe.det_score,
        "yaw": p.get("yaw"),
        "pitch": p.get("pitch"),
        "roll": p.get("roll"),
        "sharpness": p.get("sharpness"),
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


def recluster_faces():
    """Authoritative clustering: rebuild every person from the full embedding
    graph using Chinese Whispers. Order-independent and chaining-resistant —
    unlike the incremental per-photo matcher. Preserves any names already
    assigned, repicks each person's sharpest frontal key chip."""
    with session_scope() as session:
        faces = session.query(FaceEmbedding).all()
        if not faces:
            return "No faces to cluster."
        by_id = {fe.id: fe for fe in faces}
        node_ids = list(by_id.keys())

        # what each face was assigned to before — lets us keep stable person ids
        # (and names) across reruns, so re-clustering is cheap and idempotent
        old_face_of = {fe.id: fe.face_id for fe in faces}
        old_names = {
            fd.external_id: fd.name
            for fd in session.query(FaceData).all()
            if fd.name
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
            adjacency.setdefault(a, []).append((b, float(sim)))
            adjacency.setdefault(b, []).append((a, float(sim)))

        labels = _chinese_whispers(node_ids, adjacency)

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

        clusters = {}
        for fid, lbl in labels.items():
            clusters.setdefault(lbl, []).append(fid)

        # wipe old identities; embeddings stay, face_id gets rewritten.
        # null the FK references before dropping face_data rows.
        session.query(FaceEmbedding).update(
            {FaceEmbedding.face_id: None}, synchronize_session=False
        )
        session.query(PhotoFaceLink).delete()
        session.query(FaceData).delete()
        session.flush()

        people = 0
        used_ids = set()
        chips = []  # (external_id, photo_id, bbox, is_new) to crop+upload after commit
        # biggest clusters first so they claim their original person id
        for members in sorted(clusters.values(), key=len, reverse=True):
            best_id = max(members, key=lambda i: face_score(_stored_face(by_id[i])))
            best = by_id[best_id]
            best_face = _stored_face(best)

            # only surface a person we have a clean, front-facing shot of.
            # profile / back-of-head / ear-only clusters aren't useful tiles
            # (you can't tell who it is), so skip them regardless of size —
            # the photos stay in the album, just not pinned to a face tile.
            if not is_chip_worthy(best_face):
                continue

            # reuse the person id this cluster mostly came from -> stable ids +
            # we can skip re-cropping an unchanged chip. fall back to a new id.
            tally = {}
            for i in members:
                oid = old_face_of.get(i)
                if oid:
                    tally[oid] = tally.get(oid, 0) + 1
            external_id = next(
                (oid for oid, _ in sorted(tally.items(), key=lambda kv: -kv[1])
                 if oid not in used_ids),
                None,
            ) or uuid.uuid4().hex
            is_new = external_id not in old_names and external_id not in tally
            used_ids.add(external_id)

            inherited = next(
                (old_names[old_face_of[i]] for i in members
                 if old_face_of.get(i) in old_names),
                None,
            ) if old_names else None
            score = face_score(best_face)

            session.add(
                FaceData(external_id=external_id, name=inherited, key_score=score)
            )
            seen_photos = set()
            for i in members:
                fe = by_id[i]
                fe.face_id = external_id
                if fe.photo_id not in seen_photos:
                    seen_photos.add(fe.photo_id)
                    session.add(
                        PhotoFaceLink(
                            photo_id=fe.photo_id,
                            face_id=external_id,
                            album_id=fe.album_id,
                        )
                    )
            people += 1
            chips.append((external_id, best.photo_id, best_face["bbox"], is_new))

        session.commit()

        # crop + upload key chips. skip ones that already exist (reused person,
        # chip still valid) so reruns stay cheap.
        for external_id, photo_id, bbox, is_new in chips:
            if not bbox:
                continue
            if not is_new:
                try:
                    s3_client.head_object(Bucket=AWS_BUCKET, Key=f"faces/{external_id}.jpg")
                    continue  # chip already there
                except Exception:
                    pass
            row = (
                session.query(Album.slug, FileMetadata.filename)
                .join(FileMetadata, FileMetadata.album_id == Album.id)
                .filter(FileMetadata.id == photo_id)
                .first()
            )
            if not row:
                continue
            key = f"{row.slug}/{row.filename}"
            try:
                img = Image.open(
                    io.BytesIO(s3_client.get_object(Bucket=AWS_BUCKET, Key=key)["Body"].read())
                ).convert("RGB")
                buf = io.BytesIO()
                _crop(img, bbox).save(buf, format="JPEG")
                buf.seek(0)
                s3_client.upload_fileobj(
                    buf, AWS_BUCKET, f"faces/{external_id}.jpg",
                    ExtraArgs={"ContentType": "image/jpeg"},
                )
            except Exception as e:
                print(f"recluster: chip upload failed for {key}: {e}")

    print(f"recluster_faces: {people} people from {len(node_ids)} faces")
    return f"{people} people"
