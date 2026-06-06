import io
import os
import uuid

import requests
from PIL import Image
from sqlalchemy.dialects.postgresql import insert as pg_insert

from config import settings
from services.aws_service import s3_client
from db.base import session_scope
from db.models import FaceData, FaceEmbedding, PhotoFaceLink

AWS_BUCKET = settings.AWS_BUCKET

# InsightFace embedding service (GPU pod on max). Internal cluster DNS.
FACE_SERVICE_URL = os.environ.get("FACE_SERVICE_URL", "http://photoaura-faces:8000")

# cosine distance (1 - similarity) on L2-normalized ArcFace vectors.
# <= MATCH_DIST -> same person; the band up to SUGGEST_DIST is "maybe same".
MATCH_DIST = float(os.environ.get("FACE_MATCH_DIST", "0.60"))     # sim >= 0.40
SUGGEST_DIST = float(os.environ.get("FACE_SUGGEST_DIST", "0.75"))  # sim >= 0.25

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

            # a known person stays attached even in a turned/soft shot, but we
            # never mint a NEW person from a sub-par crop — that bred junk tiles
            if match is None and not chip_worthy:
                print(f"skip face {index + 1} in {file_path}: weak crop, no match")
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
