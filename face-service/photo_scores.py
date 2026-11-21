"""Whole-photo scores: a CLIP image embedding, a LAION aesthetic score and
exposure stats. CLIP runs through onnxruntime (no PyTorch in the image) and is
loaded only when PHOTO_SCORES=1, so the service still starts without weights."""

import os

import numpy as np
from PIL import Image

_DIR = os.environ.get("CLIP_DIR", "/models")
_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

_session = None
_mlp = None
_face_text = None
_face_names = None


def enabled():
    return _session is not None


def load(providers=None):
    """Open the ONNX image tower and the aesthetic head. Raises when missing."""
    global _session, _mlp
    import onnxruntime as ort

    session = ort.InferenceSession(
        os.path.join(_DIR, "clip_visual.onnx"),
        providers=providers or ["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    w = np.load(os.path.join(_DIR, "aesthetic.npz"))
    # LAION improved-aesthetic-predictor (MIT): linear layers only, dropout is off at inference
    _mlp = [(w[f"{i}.weight"], w[f"{i}.bias"]) for i in (0, 2, 4, 6, 7)]
    _session = session
    _load_face_text()


def _load_face_text():
    global _face_text, _face_names
    try:
        import json

        _face_text = np.load(os.path.join(_DIR, "face_text.npy")).astype(np.float32)
        with open(os.path.join(_DIR, "face_text.json")) as f:
            _face_names = json.load(f)
    except OSError:
        _face_text, _face_names = None, None


def face_expression(crop):
    """Zero-shot class probabilities for a face crop (relaxed smile, open mouth,
    hand on face, neutral, eating, not a face), or None without the vectors."""
    if _session is None or _face_text is None:
        return None
    feat = _session.run(None, {"image": preprocess(crop.convert("RGB"))})[0].astype(np.float32).reshape(-1)
    feat /= np.linalg.norm(feat) + 1e-6
    logits = 100.0 * (_face_text @ feat)
    p = np.exp(logits - logits.max())
    p /= p.sum()
    return {n: round(float(v), 4) for n, v in zip(_face_names, p)}


def preprocess(img):
    """OpenAI CLIP transform: bicubic resize of the short side to 224, center crop, normalize."""
    w, h = img.size
    # same integer rounding as torchvision's Resize(224) + CenterCrop(224)
    if w <= h:
        size = (224, max(224, int(224 * h / w)))
    else:
        size = (max(224, int(224 * w / h)), 224)
    img = img.resize(size, Image.BICUBIC)
    w, h = img.size
    left, top = int(round((w - 224) / 2.0)), int(round((h - 224) / 2.0))
    a = np.asarray(img.crop((left, top, left + 224, top + 224)), dtype=np.float32) / 255.0
    return ((a - _MEAN) / _STD).transpose(2, 0, 1)[None]


def aesthetic(feat):
    x = feat
    for weight, bias in _mlp:
        x = x @ weight.T + bias
    return float(x.reshape(-1)[0])


def exposure(img):
    """Share of blown highlights and crushed shadows, plus mean brightness."""
    small = img.convert("L")
    small.thumbnail((256, 256))
    g = np.asarray(small, dtype=np.float32)
    return {
        "clipped_highlights": float((g >= 250).mean()),
        "clipped_shadows": float((g <= 5).mean()),
        "mean": float(g.mean() / 255.0),
    }


def sharpness(img):
    """Detail in the sharpest tiles of the frame (Laplacian variance, 90th
    percentile over a 6x6 grid). Whole-frame blur drags every tile down, while
    shallow depth of field still leaves the subject's tiles high."""
    import cv2

    g = img.convert("L")
    g.thumbnail((768, 768))
    a = np.asarray(g)
    h, w = a.shape
    tiles = [
        cv2.Laplacian(a[y * h // 6 : (y + 1) * h // 6, x * w // 6 : (x + 1) * w // 6], cv2.CV_64F).var()
        for y in range(6)
        for x in range(6)
    ]
    return float(np.percentile(tiles, 90))


def score(img):
    """{aesthetic, clip (768 L2-normalized floats), exposure, sharpness} for a PIL RGB image."""
    # 24 MP originals: every score below works from a 1024 px copy
    img = img.copy()
    img.thumbnail((1024, 1024))
    feat = _session.run(None, {"image": preprocess(img)})[0].astype(np.float32)
    feat = feat / np.linalg.norm(feat, axis=-1, keepdims=True)
    return {
        "aesthetic": aesthetic(feat),
        "clip": feat[0].astype(float).tolist(),
        "exposure": exposure(img),
        "sharpness": sharpness(img),
    }
