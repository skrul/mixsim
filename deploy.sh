#!/usr/bin/env bash
set -euo pipefail

REMOTE="root@mixsim.local"
REMOTE_DIR="/var/www/mixsim"

echo "==> Building..."
npm run build

echo "==> Deploying app to $REMOTE:$REMOTE_DIR..."
rsync -avz --delete \
  --exclude 'stems/' \
  --exclude 'background/' \
  dist/ "$REMOTE:$REMOTE_DIR/"

echo "==> Deploying stems..."
rsync -avz --progress \
  public/stems/ "$REMOTE:$REMOTE_DIR/stems/"

echo "==> Deploying background tracks..."
rsync -avz --progress \
  public/background/ "$REMOTE:$REMOTE_DIR/background/"

echo "==> Done! Site deployed to $REMOTE:$REMOTE_DIR"
