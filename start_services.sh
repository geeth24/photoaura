#!/bin/bash

# Echo commands to the terminal
set -x

# Start the Python backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Attempt to change directory and list contents to verify
cd client

# Start the Next.js frontend
npm start &

# Keep the script running
wait
