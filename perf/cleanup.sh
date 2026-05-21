#!/usr/bin/env bash
# Purge loadtest_* test data + verify ZCARD delta vs snapshot.
set -eu

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${UPSTASH_REDIS_REST_URL:?}"
: "${UPSTASH_REDIS_REST_TOKEN:?}"

snap() {
  curl -fsS "${UPSTASH_REDIS_REST_URL}/zcard/lb:single:all" \
    -H "Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}" \
    | grep -oE '[0-9]+'
}

BEFORE=$(snap)
echo "[cleanup] ZCARD lb:single:all before=$BEFORE"

npx tsx scripts/cleanup-perf-pollution.ts

AFTER=$(snap)
echo "[cleanup] ZCARD lb:single:all after=$AFTER"
echo "[cleanup] delta=$((BEFORE - AFTER))"
