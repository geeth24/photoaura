"""Build-time only: CLIP text embeddings for the Moments vocabulary, so the
backend can label a moment without a text model.

    python export_moment_labels.py [OUT_DIR]

Reads moment_vocab.json, writes moment_labels.json and moment_labels.npy
(one L2-normalized ViT-L/14 text vector per label, the mean over its phrases and
templates) into OUT_DIR, default ../server/assets. Commit both files.
"""

import json
import os
import sys

import numpy as np
import open_clip
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = "ViT-L-14-quickgelu"


def main(out):
    with open(os.path.join(HERE, "moment_vocab.json")) as f:
        vocab = json.load(f)
    model, _, _ = open_clip.create_model_and_transforms(MODEL, pretrained="openai")
    model.eval()
    tok = open_clip.get_tokenizer(MODEL)

    vectors = []
    for item in vocab["labels"]:
        prompts = [t.format(p) for p in item["phrases"] for t in vocab["templates"]]
        with torch.no_grad():
            e = model.encode_text(tok(prompts)).float()
        e = e / e.norm(dim=-1, keepdim=True)
        mean = e.mean(dim=0)
        vectors.append((mean / mean.norm()).numpy())

    os.makedirs(out, exist_ok=True)
    np.save(os.path.join(out, "moment_labels.npy"), np.stack(vectors).astype(np.float32))
    labels = [item["label"] for item in vocab["labels"]]
    with open(os.path.join(out, "moment_labels.json"), "w") as f:
        json.dump({"model": MODEL, "labels": labels}, f, indent=2)
        f.write("\n")
    print(f"{len(labels)} labels -> {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "server", "assets"))
