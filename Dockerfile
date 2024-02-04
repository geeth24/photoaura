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
COPY client/ ./
RUN pnpm run build
# The .next directory is now inside /app/client
# Final Stage
FROM python:3.9
WORKDIR /app

RUN apt-get update && apt-get install -y ntpdate && ntpdate pool.ntp.org

RUN apt-get update && apt-get install -y libpq-dev

# Install Node.js
RUN apt-get update && apt-get install -y curl software-properties-common && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install pnpm
RUN npm install -g pnpm

# Install Python dependencies including uvicorn
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=backend /app /app
COPY --from=frontend /app/client /app/client
COPY --from=frontend /app/client/public /app/client/public
COPY start_services.sh .
RUN chmod +x start_services.sh

ENV HOSTNAME "0.0.0.0"

# Expose the ports the services run on
EXPOSE 8000
EXPOSE 3000

CMD ["./start_services.sh"]
