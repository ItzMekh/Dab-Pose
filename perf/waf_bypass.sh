#!/usr/bin/env bash
# Toggle Cloudflare WAF perf-test-bypass rule.
# Usage: bash perf/waf_bypass.sh enable|disable|status
set -eu
ACTION="${1:-status}"

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

: "${CF_API_TOKEN:?CF_API_TOKEN missing in .env.local}"
: "${CF_ZONE_ID:?CF_ZONE_ID missing in .env.local}"
: "${CF_RULE_ID:?CF_RULE_ID missing in .env.local}"

API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/rules/${CF_RULE_ID}"
AUTH="Authorization: Bearer ${CF_API_TOKEN}"

case "$ACTION" in
  enable)
    curl -fsS -X PATCH "$API" -H "$AUTH" -H "Content-Type: application/json" \
      --data '{"paused":false}' | grep -oE '"paused":(true|false)' || true
    echo "[waf] bypass ENABLED"
    ;;
  disable)
    curl -fsS -X PATCH "$API" -H "$AUTH" -H "Content-Type: application/json" \
      --data '{"paused":true}' | grep -oE '"paused":(true|false)' || true
    echo "[waf] bypass DISABLED"
    ;;
  status)
    curl -fsS "$API" -H "$AUTH" | grep -oE '"paused":(true|false)'
    ;;
  *)
    echo "Usage: $0 enable|disable|status" >&2; exit 2;;
esac
