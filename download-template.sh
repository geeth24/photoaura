#!/bin/bash
# Download a template from Rad-Soft/argocd (private repo)
#
# Usage:
#   ./download-template.sh celery-app myapp
#   ./download-template.sh simple-api photoaura

set -e

TEMPLATE=${1:-simple-api}
APP_NAME=${2:-myapp}
REPO_URL="git@github.com:Rad-Soft/argocd.git"
BRANCH="main"
BASE_PATH="templates/$TEMPLATE/chart"
TEMP_DIR=$(mktemp -d)

echo "📦 Downloading $TEMPLATE template for $APP_NAME..."

# Clone the repo using git (works with SSH keys)
echo "Cloning Rad-Soft/argocd repo..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TEMP_DIR" 2>/dev/null || {
  echo "❌ SSH clone failed, trying HTTPS..."
  REPO_URL="https://github.com/Rad-Soft/argocd.git"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TEMP_DIR" || {
    echo "❌ Failed to clone repo. Make sure you have access to Rad-Soft/argocd"
    rm -rf "$TEMP_DIR"
    exit 1
  }
}

# Check if template exists
if [ ! -d "$TEMP_DIR/$BASE_PATH" ]; then
  echo "❌ Template '$TEMPLATE' not found in repo"
  echo "Available templates:"
  ls "$TEMP_DIR/templates/" 2>/dev/null || echo "  (none found)"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Remove existing chart directory and copy new one
rm -rf chart
cp -r "$TEMP_DIR/$BASE_PATH" chart

# Cleanup temp directory
rm -rf "$TEMP_DIR"

echo "✅ Template downloaded successfully"

# Remove empty files
find chart -type f -empty -delete 2>/dev/null || true

# Replace APP_NAME placeholder
echo "✏️  Replacing APP_NAME with $APP_NAME..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  find chart -type f \( -name "*.yaml" -o -name "*.tpl" \) -exec sed -i '' "s/APP_NAME/$APP_NAME/g" {} \;
else
  # Linux
  find chart -type f \( -name "*.yaml" -o -name "*.tpl" \) -exec sed -i "s/APP_NAME/$APP_NAME/g" {} \;
fi

echo ""
echo "✅ Done! Chart created at ./chart"
echo ""
echo "Next steps:"
echo "  1. Edit chart/values.yaml with your config"
echo "  2. Copy .github/workflows/build-and-deploy.yml to your repo"
echo "  3. Push to GitHub"
echo "  4. Deploy via Launchpad or ArgoCD"
