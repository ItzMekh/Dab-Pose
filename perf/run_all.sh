#!/usr/bin/env bash
# Orchestrate all 6 layers for one round.
# Usage: bash perf/run_all.sh <round-num>
set -eu

ROUND="${1:-0}"
RUN_DIR="perf/runs/round-${ROUND}"
mkdir -p "$RUN_DIR"
LOG="$RUN_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== Perf round ${ROUND} starting $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

cleanup_exit() {
  echo "[exit] disabling WAF bypass"
  bash perf/waf_bypass.sh disable || echo "[exit] WAF disable failed — check manually!"
}
trap cleanup_exit EXIT

bash perf/preflight.sh

bash perf/waf_bypass.sh enable
echo "[orch] waiting 5s for CF propagation"
sleep 5

echo "[orch] Layer 1: k6 SMOKE"
k6 run --out json="$RUN_DIR/k6-smoke.json" perf/k6/smoke.js \
  --summary-export "$RUN_DIR/k6-smoke-summary.json" \
  || echo "[orch] smoke thresholds violated — continuing"

echo "[orch] Layer 2: k6 MODERATE"
k6 run --out json="$RUN_DIR/k6-moderate.json" perf/k6/moderate.js \
  --summary-export "$RUN_DIR/k6-moderate-summary.json" \
  || echo "[orch] moderate thresholds violated — continuing"

echo "[orch] Layer 3: k6 STRESS"
k6 run --out json="$RUN_DIR/k6-stress.json" perf/k6/stress.js \
  --summary-export "$RUN_DIR/k6-stress-summary.json" \
  || echo "[orch] stress thresholds violated — continuing"

echo "[orch] Layer 4: Lighthouse desktop"
mkdir -p "$RUN_DIR/lhci"
npx lhci collect --config=perf/lhci/lhci.config.js \
  || echo "[orch] LHCI desktop failed — continuing"

echo "[orch] Layer 4: Lighthouse mobile (extra preset)"
mkdir -p "$RUN_DIR/lhci-mobile"
npx lhci collect --config=perf/lhci/lhci.config.js --settings.preset=mobile \
  || echo "[orch] LHCI mobile failed — continuing"

echo "[orch] Layer 5: Playwright E2E load"
PERF_BASE="${PERF_BASE:-https://dabpose.fun}" \
  npx playwright test perf/playwright/realistic.spec.ts \
  --reporter=json \
  > "$RUN_DIR/playwright.json" \
  || echo "[orch] Playwright failed — continuing"

if [ "${SKIP_CLINIC:-0}" != "1" ]; then
  echo "[orch] Layer 6: clinic (local prod-build)"
  bash perf/clinic/run.sh || echo "[orch] clinic failed — continuing"
fi

echo "[orch] cleanup"
bash perf/cleanup.sh || echo "[orch] cleanup failed — manual purge needed!"

echo "=== Round ${ROUND} complete $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "[orch] artifacts in $RUN_DIR/"
