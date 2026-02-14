#!/usr/bin/env bash
set -euo pipefail

REMOTE="root@mixsim.local"
REMOTE_DIR="/var/www/mixsim"

echo "==> Building..."
npm run build

echo "==> Deploying app to $REMOTE:$REMOTE_DIR..."
rsync -avz --delete \
  --exclude 'stems/' \
  dist/ "$REMOTE:$REMOTE_DIR/"

echo "==> Deploying stems..."
rsync -avz --progress \
  public/stems/ "$REMOTE:$REMOTE_DIR/stems/"

echo "==> Deploying stems config..."
rsync -avz \
  public/stems.config.json "$REMOTE:$REMOTE_DIR/"

echo "==> Done! Site deployed to $REMOTE:$REMOTE_DIR"
