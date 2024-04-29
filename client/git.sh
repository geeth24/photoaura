#!/bin/sh
# Check if the commit affects the client directory

CLIENT_DIR="client"

# Check for changes in the client directory
if git diff --name-only HEAD HEAD~1 | grep -q "CLIENT_DIR"; then
  # If changes in the client directory are detected, exit with 1 to trigger build
  echo "Changes detected in the client directory."
  exit 1
else
  # If no changes in the client directory are detected, exit with 0 to skip build
  echo "No changes detected in the client directory."
  exit 0
fi