#!/usr/bin/env bash
# Orchestrate all 6 layers for one round.
# Usage: bash perf/run_all.sh <round-num>
#
# Env knobs:
#   SKIP_CLINIC=1   skip clinic layer
#   SKIP_STRESS=1   skip k6 stress (10-min layer)
#   SKIP_MODERATE=1 skip k6 moderate (6-min layer)
#   SKIP_LHCI=1     skip Lighthouse layer
#   SKIP_PW=1       skip Playwright layer
#
# Safety:
#   - Catches INT/TERM/HUP/QUIT to force cleanup before exit.
#   - Writes a heartbeat lock at perf/.run.lock; on next run, if found,
#     forces WAF disable + warns about a possibly-stuck prior run.
#   - SIGKILL (kill -9) cannot be trapped — `safety_check.sh` recovers from that.
set -eu

ROUND="${1:-0}"
RUN_DIR="perf/runs/round-${ROUND}"
mkdir -p "$RUN_DIR"
LOG="$RUN_DIR/run.log"
LOCK="perf/.run.lock"
exec > >(tee -a "$LOG") 2>&1

echo "=== Perf round ${ROUND} starting $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

# Stale-lock recovery — a previous run died without releasing.
if [ -f "$LOCK" ]; then
  echo "[safety] stale lock found: $(cat "$LOCK" 2>/dev/null || echo unknown)"
  echo "[safety] forcing WAF bypass DISABLE before continuing"
  bash perf/waf_bypass.sh disable || echo "[safety] WAF disable failed — check CF dashboard!"
  rm -f "$LOCK"
fi

echo "round=${ROUND} pid=$$ start=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK"

cleanup_exit() {
  local sig="${1:-EXIT}"
  echo "[exit:${sig}] disabling WAF bypass"
  bash perf/waf_bypass.sh disable || echo "[exit:${sig}] WAF disable failed — check manually!"
  rm -f "$LOCK"
  if [ "$sig" != "EXIT" ]; then
    exit 130
  fi
}
trap 'cleanup_exit EXIT' EXIT
trap 'cleanup_exit INT'  INT
trap 'cleanup_exit TERM' TERM
trap 'cleanup_exit HUP'  HUP
trap 'cleanup_exit QUIT' QUIT

bash perf/preflight.sh

bash perf/waf_bypass.sh enable
echo "[orch] waiting 5s for CF propagation"
sleep 5

echo "[orch] Layer 1: k6 SMOKE"
k6 run --out json="$RUN_DIR/k6-smoke.json" perf/k6/smoke.js \
  --summary-export "$RUN_DIR/k6-smoke-summary.json" \
  || echo "[orch] smoke thresholds violated — continuing"

if [ "${SKIP_MODERATE:-0}" != "1" ]; then
  echo "[orch] Layer 2: k6 MODERATE"
  k6 run --out json="$RUN_DIR/k6-moderate.json" perf/k6/moderate.js \
    --summary-export "$RUN_DIR/k6-moderate-summary.json" \
    || echo "[orch] moderate thresholds violated — continuing"
else
  echo "[orch] Layer 2: SKIPPED (SKIP_MODERATE=1)"
fi

if [ "${SKIP_STRESS:-0}" != "1" ]; then
  echo "[orch] Layer 3: k6 STRESS"
  k6 run --out json="$RUN_DIR/k6-stress.json" perf/k6/stress.js \
    --summary-export "$RUN_DIR/k6-stress-summary.json" \
    || echo "[orch] stress thresholds violated — continuing"
else
  echo "[orch] Layer 3: SKIPPED (SKIP_STRESS=1)"
fi

if [ "${SKIP_LHCI:-0}" != "1" ]; then
  echo "[orch] Layer 4: Lighthouse desktop"
  mkdir -p "$RUN_DIR/lhci"
  npx lhci collect --config=perf/lhci/lhci.config.js \
    || echo "[orch] LHCI desktop failed — continuing"

  echo "[orch] Layer 4: Lighthouse mobile (extra preset)"
  mkdir -p "$RUN_DIR/lhci-mobile"
  npx lhci collect --config=perf/lhci/lhci.config.js --settings.preset=mobile \
    || echo "[orch] LHCI mobile failed — continuing"
else
  echo "[orch] Layer 4: SKIPPED (SKIP_LHCI=1)"
fi

if [ "${SKIP_PW:-0}" != "1" ]; then
  echo "[orch] Layer 5: Playwright E2E load"
  PERF_BASE="${PERF_BASE:-https://dabpose.fun}" \
    npx playwright test perf/playwright/realistic.spec.ts \
    --reporter=json \
    > "$RUN_DIR/playwright.json" \
    || echo "[orch] Playwright failed — continuing"
else
  echo "[orch] Layer 5: SKIPPED (SKIP_PW=1)"
fi

if [ "${SKIP_CLINIC:-0}" != "1" ]; then
  echo "[orch] Layer 6: clinic (local prod-build)"
  bash perf/clinic/run.sh || echo "[orch] clinic failed — continuing"
else
  echo "[orch] Layer 6: SKIPPED (SKIP_CLINIC=1)"
fi

echo "[orch] cleanup"
bash perf/cleanup.sh || echo "[orch] cleanup failed — manual purge needed!"

echo "=== Round ${ROUND} complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "[orch] artifacts in $RUN_DIR/"
