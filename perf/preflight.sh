#!/usr/bin/env bash
# Abort if Upstash daily command count > 80% of free-tier quota (500k).
set -eu

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${UPSTASH_REDIS_REST_URL:?UPSTASH_REDIS_REST_URL missing}"
: "${UPSTASH_REDIS_REST_TOKEN:?UPSTASH_REDIS_REST_TOKEN missing}"

DAILY_LIMIT=500000
THRESHOLD=$(( DAILY_LIMIT * 80 / 100 ))

RAW=$(curl -fsS "${UPSTASH_REDIS_REST_URL}/info" \
  -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}")

COUNT=$(echo "$RAW" | grep -oE 'total_commands_processed:[0-9]+' | head -1 | grep -oE '[0-9]+$')
COUNT="${COUNT:-0}"

echo "[preflight] Upstash commands today=$COUNT  threshold=$THRESHOLD"

if [ "$COUNT" -gt "$THRESHOLD" ]; then
  echo "[preflight] ABORT — quota usage above 80%"
  exit 1
fi
echo "[preflight] OK"
