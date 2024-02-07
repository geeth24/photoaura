#!/bin/bash

# Echo commands to the terminal
set -x

# Start the Python backend
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Attempt to change directory and list contents to verify
cd client

# Add this line in your `start_services.sh` script before `pnpm run start` or `next start`
ls -al /app/client/.next


# Start the Next.js frontend
npm start &

# Keep the script running
wait
