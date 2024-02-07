#!/bin/sh
# Check if the commit affects the marketing directory

MARKETING_DIR="marketing"

# Check for changes in the marketing directory
if git diff --name-only HEAD HEAD~1 | grep -q "$MARKETING_DIR"; then
  # If changes in the marketing directory are detected, exit with 1 to trigger build
  echo "Changes detected in the marketing directory."
  exit 1
else
  # If no changes in the marketing directory are detected, exit with 0 to skip build
  echo "No changes detected in the marketing directory."
  exit 0
fi
