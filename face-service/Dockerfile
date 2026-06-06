FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-dev python3-pip build-essential cmake \
        ffmpeg libsm6 libxext6 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# onnxruntime-gpu 1.18 matches CUDA 12 + cuDNN 9 in the base image
RUN pip3 install --no-cache-dir \
        numpy==1.26.4 \
        onnxruntime-gpu==1.18.1 \
        insightface==0.7.3 \
        fastapi "uvicorn[standard]" boto3 pillow

# bake the buffalo_l model pack into the image (CPU download at build time)
RUN python3 -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1, det_size=(640,640))"

COPY app.py /app/app.py
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
