"""Build-time only: export OpenAI CLIP ViT-L/14 (quickgelu) image tower to ONNX
and the LAION aesthetic head to numpy, so the runtime image needs no PyTorch.

    python export_clip.py OUT_DIR AESTHETIC_PTH [--fp32]

Also writes face_text.npy/json: one text vector per class in face_expr_vocab.json
(relaxed smile, open mouth, hand on face...), used to judge thumbnail crops.
"""

import json
import os
import sys

import numpy as np
import onnx
import onnxruntime as ort
import open_clip
import torch


def main(out, pth, fp32):
    os.makedirs(out, exist_ok=True)
    model, _, _ = open_clip.create_model_and_transforms("ViT-L-14-quickgelu", pretrained="openai")
    visual = model.visual.eval()
    x = torch.randn(1, 3, 224, 224)
    ref = visual(x).detach().numpy()

    path = os.path.join(out, "clip_visual.onnx")
    torch.onnx.export(
        visual, x, path, input_names=["image"], output_names=["embedding"],
        dynamic_axes={"image": {0: "batch"}, "embedding": {0: "batch"}},
        opset_version=17, dynamo=False,
    )

    if not fp32:
        # fp16 only ships if it loads and still matches the torch tower
        try:
            from onnxconverter_common import float16

            half = float16.convert_float_to_float16(onnx.load(path), keep_io_types=True)
            onnx.save(half, path + ".fp16")
            a = ort.InferenceSession(path + ".fp16", providers=["CPUExecutionProvider"]).run(None, {"image": x.numpy()})[0]
            cos = float((a * ref).sum() / (np.linalg.norm(a) * np.linalg.norm(ref)))
            ok = cos >= 0.9995
        except Exception as e:
            print("fp16 conversion invalid:", str(e)[:120])
            ok, cos = False, 0.0
        if ok:
            os.replace(path + ".fp16", path)
            print(f"clip onnx: fp16 (cosine {cos:.5f})")
        else:
            if os.path.exists(path + ".fp16"):
                os.remove(path + ".fp16")
            print("clip onnx: fp32")
    b = ort.InferenceSession(path, providers=["CPUExecutionProvider"]).run(None, {"image": x.numpy()})[0]
    print("exported cosine vs torch", float((b * ref).sum() / (np.linalg.norm(b) * np.linalg.norm(ref))))

    vocab_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_expr_vocab.json")
    if os.path.exists(vocab_path):
        with open(vocab_path) as f:
            vocab = json.load(f)
        tok = open_clip.get_tokenizer("ViT-L-14-quickgelu")
        names, vecs = [], []
        for name, phrases in vocab["classes"].items():
            prompts = [t.format(p) for p in phrases for t in vocab["templates"]]
            with torch.no_grad():
                e = model.encode_text(tok(prompts)).float()
            e = e / e.norm(dim=-1, keepdim=True)
            m = e.mean(dim=0)
            vecs.append((m / m.norm()).numpy())
            names.append(name)
        np.save(os.path.join(out, "face_text.npy"), np.stack(vecs).astype(np.float32))
        with open(os.path.join(out, "face_text.json"), "w") as f:
            json.dump(names, f)
        print("face text classes:", names)

    state = torch.load(pth, map_location="cpu")
    np.savez(os.path.join(out, "aesthetic.npz"), **{k.replace("layers.", ""): v.numpy() for k, v in state.items()})


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--fp32" in sys.argv)
