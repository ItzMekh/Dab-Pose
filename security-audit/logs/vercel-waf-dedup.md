# Vercel WAF — Rate-Limit Rule Disabled (Dedup with Cloudflare)

**Date**: 2026-05-20
**Project**: dab-pose (Vercel)
**Action**: disabled `rule_rate_limit_api_score_post_LfqWz5`
**Reason**: deduplication with Cloudflare edge after the orange-cloud migration

## Before / after

| # | Rule | Action | Status |
|---|---|---|---|
| 1 | Rate limit /api/score POST | Rate Limit 30/60s/IP | ~~Enabled~~ → **Disabled** |
| 2 | Block exploit probes | Deny | Enabled (kept) |
| 3 | Log signup POSTs | Log | Enabled (kept) |

## Why disable #1

After the Cloudflare proxy went live (zone activated 2026-05-20 02:04 UTC) every visitor request now lands on CF anycast first, where Bot Fight Mode + the platform's always-on DDoS mitigation throttle volumetric abuse at the edge. The per-IP rate limit on /api/score that Vercel was enforcing duplicates that work and still costs a function invocation to evaluate — pre-decision. Removing it shifts pure rate-limit cost to CF (free at any scale on Free plan).

## Why keep #2 and #3

- **Exploit-probe deny** — defense in depth. If anyone bypasses CF (e.g. by directly hitting a Vercel preview deployment, or a leaked origin IP), Vercel still 403s `/wp-admin`, `/.env`, `/.git/config`, etc. CF blocks the same paths in front, so the rule rarely fires in production but is cheap insurance.
- **Signup log** — observability. Helps correlate /api/auth/signup hits with downstream behaviour (e.g. spam waves) independent of Cloudflare's analytics.

## What still rate-limits /api/score

- **Cloudflare** — Bot Fight Mode JS challenge for known bot patterns; CF DDoS auto-throttle for volumetric attack.
- **Application** — `/api/score` requires a Turnstile-gated session for authenticated submissions, a proof-of-play token (single-use, 60s TTL) for every submission, and the existing CSRF Origin check + `time_ms <= elapsed` integrity check.

## Verify command

```bash
vercel firewall rules ls
```

Expected: rule #1 shows `Disabled` (red), #2 and #3 show `Enabled` (green).

## Rollback

```bash
vercel firewall rules enable rule_rate_limit_api_score_post_LfqWz5 --yes
vercel firewall publish --yes
```
