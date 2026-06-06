"""InsightFace embedding service — runs on the GPU box, shared with FaceFusion.

Takes an S3 image, runs RetinaFace detection + ArcFace embedding (buffalo_l),
returns each face's bbox, detection score, pose, and a 512-d L2-normalized
embedding. The PhotoAura backend calls /embed instead of AWS Rekognition;
clustering + matching happen in Postgres via pgvector.
"""

import io
import os

import boto3
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel
from insightface.app import FaceAnalysis

app = FastAPI(title="photoaura-faces")

_MODEL = os.environ.get("FACE_MODEL", "buffalo_l")
_face = FaceAnalysis(
    name=_MODEL,
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
)
# ctx_id=0 -> first GPU; det_size is the detector input resolution
_face.prepare(ctx_id=0, det_size=(640, 640))

_s3 = boto3.client(
    "s3",
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
)


class EmbedRequest(BaseModel):
    bucket: str
    key: str


def _sharpness(arr, bbox):
    """Variance of the Laplacian on a fixed-size crop — a resolution-independent
    blur score. Sharp faces land in the hundreds/thousands, blurry ones < ~80."""
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


@app.get("/health")
def health():
    return {"ok": True, "model": _MODEL}


@app.post("/embed")
def embed(req: EmbedRequest):
    try:
        obj = _s3.get_object(Bucket=req.bucket, Key=req.key)
        data = obj["Body"].read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"s3 fetch failed: {e}")

    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"image decode failed: {e}")

    # insightface expects BGR
    arr = np.asarray(img)[:, :, ::-1]
    faces = _face.get(arr)

    out = []
    for f in faces:
        x1, y1, x2, y2 = (int(v) for v in f.bbox)
        pose = getattr(f, "pose", None)
        out.append({
            "bbox": [x1, y1, x2, y2],
            "det_score": float(f.det_score),
            "sharpness": _sharpness(arr, [x1, y1, x2, y2]),
            # already L2-normalized -> cosine == dot product
            "embedding": f.normed_embedding.astype(float).tolist(),
            "yaw": float(pose[1]) if pose is not None else 0.0,
            "pitch": float(pose[0]) if pose is not None else 0.0,
            "roll": float(pose[2]) if pose is not None else 0.0,
        })

    return {"img_w": img.width, "img_h": img.height, "faces": out}
