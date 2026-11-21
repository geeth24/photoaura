FROM python:3.9-slim
WORKDIR /app

# system packages and Python deps before the code, so a code-only push reuses these layers
RUN apt-get update -o Acquire::Check-Valid-Until=false && \
    apt-get install -y libpq-dev ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server /app/

# Run migrations then start the application
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
