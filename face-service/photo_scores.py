"""Whole-photo scores: a CLIP image embedding, a LAION aesthetic score and
exposure stats. Loaded only when PHOTO_SCORES=1, so the face service still
starts on a box without the weights."""

import os

import numpy as np

_CLIP_NAME = "ViT-L-14-quickgelu"
_AESTHETIC_PATH = os.environ.get("AESTHETIC_WEIGHTS", "/models/aesthetic.pth")

_model = None
_preprocess = None
_mlp = None
_device = "cpu"


def enabled():
    return _model is not None


def load():
    """Load CLIP + the aesthetic head. Raises when the weights are missing."""
    global _model, _preprocess, _mlp, _device
    import open_clip
    import torch
    from torch import nn

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms(
        _CLIP_NAME, pretrained="openai", device=_device
    )
    model.eval()
    if _device == "cuda":
        model.half()

    # LAION improved-aesthetic-predictor (MIT), linear-MSE head on ViT-L/14
    mlp = nn.Sequential()
    mlp.add_module("0", nn.Linear(768, 1024))
    mlp.add_module("1", nn.Dropout(0.2))
    mlp.add_module("2", nn.Linear(1024, 128))
    mlp.add_module("3", nn.Dropout(0.2))
    mlp.add_module("4", nn.Linear(128, 64))
    mlp.add_module("5", nn.Dropout(0.1))
    mlp.add_module("6", nn.Linear(64, 16))
    mlp.add_module("7", nn.Linear(16, 1))
    state = torch.load(_AESTHETIC_PATH, map_location="cpu")
    mlp.load_state_dict({k.replace("layers.", ""): v for k, v in state.items()})
    mlp.eval().to(_device)

    _model, _preprocess, _mlp = model, preprocess, mlp


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
    import torch

    # 24 MP originals: every score below works from a 1024 px copy
    img = img.copy()
    img.thumbnail((1024, 1024))
    with torch.no_grad():
        x = _preprocess(img).unsqueeze(0).to(_device)
        if _device == "cuda":
            x = x.half()
        feat = _model.encode_image(x).float()
        feat = feat / feat.norm(dim=-1, keepdim=True)
        aesthetic = float(_mlp(feat).squeeze())
    return {
        "aesthetic": aesthetic,
        "clip": feat.squeeze(0).cpu().numpy().astype(float).tolist(),
        "exposure": exposure(img),
        "sharpness": sharpness(img),
    }
