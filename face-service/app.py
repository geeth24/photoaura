"""InsightFace embedding service — runs on the GPU box, shared with FaceFusion.

Takes an S3 image, runs RetinaFace detection + ArcFace embedding (buffalo_l),
returns each face's bbox, detection score, pose, and a 512-d L2-normalized
embedding, plus the quality and expression signals the backend uses to drop
junk detections and pick thumbnails. Clustering + matching happen in Postgres
via pgvector.
"""

import io
import os

import boto3
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageOps
from pydantic import BaseModel
from insightface.app import FaceAnalysis
from insightface.app.common import Face
from insightface.utils import face_align

app = FastAPI(title="photoaura-faces")

_MODEL = os.environ.get("FACE_MODEL", "buffalo_l")
# a 24 MP photo shrunk to 640 loses faces under ~140px; 1280 finds them, and
# the 640 pass still catches close-ups bigger than the 1280 pass's anchors
_DET_SIZES = [
    int(s) for s in os.environ.get("FACE_DET_SIZES", "640,1280").split(",") if s.strip()
]
# smaller detections are dropped by the backend anyway; skip the other models on them
_MIN_PX = int(os.environ.get("FACE_MIN_PX", "40"))
_face = FaceAnalysis(
    name=_MODEL,
    root=os.environ.get("INSIGHTFACE_ROOT", "~/.insightface"),
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
)
# ctx_id=0 -> first GPU
_face.prepare(ctx_id=0, det_size=(_DET_SIZES[0], _DET_SIZES[0]))

_s3 = boto3.client(
    "s3",
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
)


class EmbedRequest(BaseModel):
    bucket: str
    key: str


def _detect(arr):
    """Detect at every configured size and merge the overlaps."""
    boxes, points = [], []
    for size in _DET_SIZES:
        b, k = _face.det_model.detect(arr, input_size=(size, size), max_num=0)
        if len(b):
            boxes.append(b)
            points.append(k)
    if not boxes:
        return np.zeros((0, 5), np.float32), np.zeros((0, 5, 2), np.float32)
    b = np.vstack(boxes)
    k = np.vstack(points)
    keep = _face.det_model.nms(b)
    return b[keep], k[keep]


def _analyze(arr):
    """FaceAnalysis.get, with our own multi-size detection in front."""
    bboxes, kpss = _detect(arr)
    faces = []
    for i in range(bboxes.shape[0]):
        x1, y1, x2, y2 = bboxes[i, :4]
        if min(x2 - x1, y2 - y1) < _MIN_PX:
            continue
        face = Face(bbox=bboxes[i, :4], kps=kpss[i], det_score=bboxes[i, 4])
        for task, model in _face.models.items():
            if task != "detection":
                model.get(arr, face)
        faces.append(face)
    return faces


def _sharpness(arr, bbox):
    """Variance of the Laplacian on a fixed-size crop. Kept for old rows; grain
    on high-ISO shots fools it, so the backend prefers `blur`."""
    x1, y1, x2, y2 = bbox
    h, w = arr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    crop = arr[y1:y2, x1:x2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (160, 160), interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _blur(arr, kps):
    """Focus on the aligned face, shrunk to 56px and normalized by contrast.
    High-ISO grain doesn't fool it the way the raw Laplacian was fooled. Sharp
    faces land ~60-250, out-of-focus ones < ~25."""
    aligned = face_align.norm_crop(arr, kps, 112)
    gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY).astype(np.float64)
    gray = cv2.resize(gray, (56, 56), interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var() / (gray.var() + 1e-6) * 100)


# insightface 2d106: 33-42 and 87-96 are the eyes (38, 88 pupils; 35/39 and
# 89/93 corners), 52 and 61 the mouth corners, 53/71 the outer lip midpoints,
# 60/62 the inner ones
def _landmark_agreement(kps, lmk, bbox):
    """How far the detector's 5 points sit from the 106-point mesh, as a share
    of the face's size. Frontal faces ~0.03 (99% under 0.21), profiles similar;
    ears, backs of heads and hands run higher. Face size, not eye distance:
    the eyes nearly touch on a profile, which made real profiles look like junk."""
    x1, y1, x2, y2 = bbox
    size = float(np.sqrt(max(1.0, (x2 - x1) * (y2 - y1))))
    pairs = ((kps[0], lmk[38]), (kps[1], lmk[88]), (kps[3], lmk[52]), (kps[4], lmk[61]))
    return float(np.mean([np.linalg.norm(a - b) for a, b in pairs]) / size)


def _expression(lmk):
    """Smile 0-1, eye openness and gaze offset from the 106-point mesh, measured
    with the eyes levelled and scaled to the distance between the pupils."""
    a, b = lmk[38], lmk[88]
    v = b - a
    iod = float(np.linalg.norm(v)) + 1e-6
    c, s = v / iod
    p = (lmk - (a + b) / 2) @ np.array([[c, s], [-s, c]]).T / iod
    if p[61, 0] < p[52, 0]:
        p[:, 0] *= -1

    width = float(np.linalg.norm(p[61] - p[52]))
    lift = float((p[71, 1] + p[53, 1]) / 2 - (p[52, 1] + p[61, 1]) / 2)
    teeth = float(abs(p[60, 1] - p[62, 1]))
    smile = (
        0.5 * np.clip((lift - 0.02) / 0.10, 0, 1)
        + 0.35 * np.clip((width - 0.80) / 0.30, 0, 1)
        + 0.15 * np.clip(teeth / 0.12, 0, 1)
    )

    def eye(idx, ca, cb, pupil):
        pts = p[idx]
        w = pts[:, 0].max() - pts[:, 0].min()
        h = pts[:, 1].max() - pts[:, 1].min()
        lo, hi = sorted((p[ca, 0], p[cb, 0]))
        return h / (w + 1e-6), (p[pupil, 0] - lo) / (hi - lo + 1e-6)

    open1, g1 = eye(list(range(33, 43)), 35, 39, 38)
    open2, g2 = eye(list(range(87, 97)), 89, 93, 88)
    return {
        "smile": float(smile),
        "eye_open": float((open1 + open2) / 2),
        "gaze": float(abs((g1 + g2) / 2 - 0.5)),
    }


def describe(arr):
    """Every face in a BGR image as the dict /embed returns."""
    out = []
    for f in _analyze(arr):
        x1, y1, x2, y2 = (int(v) for v in f.bbox)
        pose = getattr(f, "pose", None)
        lmk = getattr(f, "landmark_2d_106", None)
        face = {
            "bbox": [x1, y1, x2, y2],
            "det_score": float(f.det_score),
            "sharpness": _sharpness(arr, [x1, y1, x2, y2]),
            "blur": _blur(arr, f.kps),
            # already L2-normalized -> cosine == dot product
            "embedding": f.normed_embedding.astype(float).tolist(),
            # the raw length drops for things that aren't really faces
            "emb_norm": float(np.linalg.norm(f.embedding)),
            "kps": f.kps.astype(float).round(1).tolist(),
            "yaw": float(pose[1]) if pose is not None else 0.0,
            "pitch": float(pose[0]) if pose is not None else 0.0,
            "roll": float(pose[2]) if pose is not None else 0.0,
            "eye_open": None,
            "smile": None,
            "gaze": None,
            "landmark_agreement": None,
        }
        if lmk is not None:
            face["landmark_agreement"] = _landmark_agreement(f.kps, lmk, f.bbox)
            face.update(_expression(lmk))
        out.append(face)
    return out


@app.get("/health")
def health():
    return {"ok": True, "model": _MODEL, "det_sizes": _DET_SIZES}


@app.post("/embed")
def embed(req: EmbedRequest):
    try:
        obj = _s3.get_object(Bucket=req.bucket, Key=req.key)
        data = obj["Body"].read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"s3 fetch failed: {e}")

    try:
        # cameras store portrait shots rotated with an EXIF flag; analyse
        # what a viewer sees or the faces come out sideways
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"image decode failed: {e}")

    # insightface expects BGR
    arr = np.ascontiguousarray(np.asarray(img)[:, :, ::-1])
    return {"img_w": img.width, "img_h": img.height, "faces": describe(arr)}
