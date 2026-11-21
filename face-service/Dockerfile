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

# CLIP ViT-L/14 (OpenAI weights) and the LAION aesthetic head, baked in like
# buffalo_l so the pod never downloads at start
RUN mkdir -p /models && pip3 install --no-cache-dir torch open_clip_torch
ENV HF_HOME=/models/hf PHOTO_SCORES=1
RUN python3 -c "import open_clip; open_clip.create_model_and_transforms('ViT-L-14-quickgelu', pretrained='openai')" \
    && python3 -c "import urllib.request as u; u.urlretrieve('https://github.com/christophschuhmann/improved-aesthetic-predictor/raw/main/sac+logos+ava1-l14-linearMSE.pth', '/models/aesthetic.pth')"

# bake the buffalo_l model pack into the image — just download + extract,
# no inference session (which segfaults at build time without a GPU)
RUN python3 -c "from insightface.utils.storage import ensure_available; ensure_available('models','buffalo_l', root='/root/.insightface')"

COPY app.py photo_scores.py /app/
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
