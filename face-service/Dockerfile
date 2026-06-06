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
        onnxruntime-gpu==1.20.1 \
        insightface==0.7.3 \
        fastapi "uvicorn[standard]" boto3 pillow

# bake the buffalo_l model pack into the image — just download + extract,
# no inference session (which segfaults at build time without a GPU)
RUN python3 -c "from insightface.utils.storage import ensure_available; ensure_available('models','buffalo_l', root='/root/.insightface')"

COPY app.py /app/app.py
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
