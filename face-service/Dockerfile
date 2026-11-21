# stage 1: export CLIP ViT-L/14 (OpenAI weights, quickgelu) to ONNX with CPU-only
# PyTorch. Nothing from this stage reaches the final image except the exports.
FROM python:3.11-slim AS clip-export
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install --no-cache-dir open_clip_torch onnx onnxconverter-common onnxruntime numpy pillow
ADD https://github.com/christophschuhmann/improved-aesthetic-predictor/raw/main/sac+logos+ava1-l14-linearMSE.pth /aesthetic.pth
COPY export_clip.py /export_clip.py
RUN python /export_clip.py /out /aesthetic.pth

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-dev python3-pip build-essential cmake \
        ffmpeg libsm6 libxext6 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# onnxruntime-gpu 1.20.x ships the CUDA 12 + cuDNN 9 build on PyPI (matches
# the base image). 1.18 defaulted to CUDA 11 -> libcublasLt.so.11 not found.
RUN pip3 install --no-cache-dir \
        numpy==1.26.4 \
        onnxruntime-gpu==1.20.2 \
        insightface==0.7.3 \
        fastapi "uvicorn[standard]" boto3 pillow

# bake the buffalo_l model pack into the image — just download + extract,
# no inference session (which segfaults at build time without a GPU)
RUN python3 -c "from insightface.utils.storage import ensure_available; ensure_available('models','buffalo_l', root='/root/.insightface')"

# CLIP image tower + aesthetic head, exported above; no PyTorch in this image
COPY --from=clip-export /out/clip_visual.onnx /out/aesthetic.npz /models/
ENV CLIP_DIR=/models PHOTO_SCORES=1

COPY app.py photo_scores.py /app/
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
