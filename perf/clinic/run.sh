#!/usr/bin/env bash
# Profile local prod-build with clinic doctor + flame.
# Runs against http://localhost:3000 — never prod.
set -eu

OUT="perf/runs/round-0/clinic"
mkdir -p "$OUT"

echo "[clinic] building prod bundle"
npm run build

echo "[clinic] running clinic doctor"
npx clinic doctor --on-port "npx autocannon -c 50 -d 30 http://localhost:\$PORT/api/leaderboard" \
  --dest "$OUT" \
  -- node node_modules/.bin/next start

echo "[clinic] running clinic flame"
npx clinic flame --on-port "npx autocannon -c 50 -d 30 http://localhost:\$PORT/api/leaderboard" \
  --dest "$OUT" \
  -- node node_modules/.bin/next start

echo "[clinic] HTML reports in $OUT/"
ls "$OUT"/*.html 2>/dev/null || echo "[clinic] no HTML produced — check stderr"
