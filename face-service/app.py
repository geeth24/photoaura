"""InsightFace embedding service — runs on the GPU box, shared with FaceFusion.

Takes an S3 image, runs RetinaFace detection + ArcFace embedding (buffalo_l),
returns each face's bbox, detection score, pose, and a 512-d L2-normalized
embedding. The PhotoAura backend calls /embed instead of AWS Rekognition;
clustering + matching happen in Postgres via pgvector.
"""

import io
import os

import boto3
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
            # already L2-normalized -> cosine == dot product
            "embedding": f.normed_embedding.astype(float).tolist(),
            "yaw": float(pose[1]) if pose is not None else 0.0,
            "pitch": float(pose[0]) if pose is not None else 0.0,
            "roll": float(pose[2]) if pose is not None else 0.0,
        })

    return {"img_w": img.width, "img_h": img.height, "faces": out}
