# WAF Bypass — One-Time Setup

1. CF dashboard → Security → WAF → Custom Rules → Create rule
2. Name: `perf-test-bypass`
3. Expression (edit as expression):
   `(http.request.headers["x-perf-test"][0] eq "<PASTE_PERF_BYPASS_TOKEN>")`
4. Action: **Skip** → check "All custom rules" + "All rate limiting rules"
5. Save as **Paused / Disabled**
6. Copy rule ID from URL (`.../rules/<RULE_ID>`)
7. Paste into `.env.local` as `CF_RULE_ID`
8. Test: `bash perf/waf_bypass.sh enable && bash perf/waf_bypass.sh disable`
