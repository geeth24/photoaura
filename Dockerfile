# Stage 1: Python Backend Setup
FROM python:3.9 AS backend
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
COPY server /app/

# Stage 2: Next.js Frontend Setup
FROM node:20 AS frontend
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY .env* ./
COPY client/ ./
RUN pnpm run build

# Final Stage
FROM python:3.9-slim
WORKDIR /app

# Install system dependencies, Node.js, and cleanup in one step
RUN apt-get update -o Acquire::Check-Valid-Until=false && \
    apt-get install -y libpq-dev curl software-properties-common && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=backend /app /app
COPY --from=frontend /app/client /app/client