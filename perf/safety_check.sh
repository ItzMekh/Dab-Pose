#!/usr/bin/env bash
# Recover from a stuck perf run.
# Usage: bash perf/safety_check.sh
#
# Run this if a previous perf run was SIGKILL'd or otherwise crashed without
# disabling WAF bypass. Idempotent — safe to run anytime.
set -eu

LOCK="perf/.run.lock"

if [ -f "$LOCK" ]; then
  echo "[safety] stale lock: $(cat "$LOCK")"
else
  echo "[safety] no stale lock"
fi

echo "[safety] WAF bypass current status:"
bash perf/waf_bypass.sh status

echo "[safety] forcing WAF bypass DISABLE (idempotent)"
bash perf/waf_bypass.sh disable

echo "[safety] WAF bypass status after:"
bash perf/waf_bypass.sh status

rm -f "$LOCK"

echo "[safety] purging any loadtest data"
bash perf/cleanup.sh || echo "[safety] cleanup failed — inspect Redis manually"

echo "[safety] done"
