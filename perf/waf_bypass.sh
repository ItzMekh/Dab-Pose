#!/usr/bin/env bash
# Toggle Cloudflare WAF perf-test-bypass rule.
# Usage: bash perf/waf_bypass.sh enable|disable|status
# Uses PUT (full rule body) because CF Firewall Rules v1 PATCH does not honor `paused`.
set -eu
ACTION="${1:-status}"

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${CF_API_TOKEN:?CF_API_TOKEN missing in .env.local}"
: "${CF_ZONE_ID:?CF_ZONE_ID missing in .env.local}"
: "${CF_RULE_ID:?CF_RULE_ID missing in .env.local}"
: "${CF_FILTER_ID:?CF_FILTER_ID missing in .env.local}"

API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/rules/${CF_RULE_ID}"
AUTH="Authorization: Bearer ${CF_API_TOKEN}"
PRODUCTS='["waf","rateLimit","securityLevel","bic","hot","uaBlock","zoneLockdown"]'

put_paused() {
  local paused="$1"
  curl -fsS -X PUT "$API" -H "$AUTH" -H "Content-Type: application/json" \
    --data "{\"id\":\"${CF_RULE_ID}\",\"paused\":${paused},\"action\":\"bypass\",\"products\":${PRODUCTS},\"filter\":{\"id\":\"${CF_FILTER_ID}\"}}" \
    | grep -oE '"paused":[[:space:]]*(true|false)' | head -n 1
}

case "$ACTION" in
  enable)
    put_paused false
    echo "[waf] bypass ENABLED"
    ;;
  disable)
    put_paused true
    echo "[waf] bypass DISABLED"
    ;;
  status)
    curl -fsS "$API" -H "$AUTH" | grep -oE '"paused":[[:space:]]*(true|false)' | head -n 1
    ;;
  *)
    echo "Usage: $0 enable|disable|status" >&2; exit 2;;
esac
