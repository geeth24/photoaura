#!/bin/sh
set -e

# Apply database migrations (safe on fresh, pre-Alembic, and already-managed DBs)
python -m db.migrate

# Ensure the root user exists
python -m db.seed

exec uvicorn main:app --host 0.0.0.0 --port 8000
