# Stage 1: Python Backend Setup
FROM python:3.9 AS backend
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
COPY server /app/

# Final Stage
FROM python:3.9-slim
WORKDIR /app
COPY --from=backend /app /app

# Install system dependencies
RUN apt-get update -o Acquire::Check-Valid-Until=false && \
    apt-get install -y libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
