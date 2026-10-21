#!/usr/bin/env bash
# Zero-downtime deploy for the VPS.
#   1. pull main  2. build into .next-build while the live site keeps running from .next
#   3. keep the previous build's static chunks so already-open tabs can still load them
#   4. swap directories atomically  5. pm2 rolling reload (cluster, 2 instances)
# Never runs `prisma migrate deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=/tmp/deploy-$(date +%Y%m%d-%H%M%S).log
if [ "${SKIP_PULL:-0}" != "1" ]; then git pull --ff-only origin main; fi
LOCK_SUM=$(sha256sum package-lock.json | cut -c1-64)
if [ -f .deploy-lock.sum ] && [ "$(cat .deploy-lock.sum)" != "$LOCK_SUM" ]; then
  echo "package-lock.json changed: run npm ci manually in a maintenance window first." ; exit 1
fi
echo "$LOCK_SUM" > .deploy-lock.sum
npx prisma generate >>"$LOG" 2>&1
rm -rf .next-build
NEXT_DIST_DIR=.next-build npm run build >>"$LOG" 2>&1 || { echo "BUILD FAILED, live site untouched. See $LOG"; exit 1; }
if [ -d .next/static ]; then cp -rn .next/static/. .next-build/static/ ; fi
rm -rf .next-prev
mv .next .next-prev 2>/dev/null || true
mv .next-build .next
if pm2 describe workman-erp >/dev/null 2>&1 && pm2 jlist | grep -q '"exec_mode":"cluster_mode"'; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 delete workman-erp >/dev/null 2>&1 || true
  pm2 start ecosystem.config.js
fi
pm2 save >/dev/null
echo "Deployed $(git log -1 --oneline). Log: $LOG"
