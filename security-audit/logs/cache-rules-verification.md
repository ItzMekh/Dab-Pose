# Cloudflare Cache Rule — Deployment + Verification

**Date**: 2026-05-20
**Zone**: dabpose.fun (7296c14f79fc8a6177113bfa9a943917)
**Plan**: Free Website
**Deployed via**: CF dashboard (browser-driven through Claude MCP)

## Rule

```
Name:    Bypass cache for dynamic + auth paths
Order:   1
Status:  Active
Action:  Bypass cache
Expression:
  (starts_with(http.request.uri.path, "/api/"))
  or (http.request.uri.path eq "/login")
  or (http.request.uri.path eq "/signup")
  or (starts_with(http.request.uri.path, "/profile/"))
```

## Why

- `/api/*` — every route is dynamic (auth state, rate-limit, JSON). Must not be cached at the edge or stale auth + stale leaderboards leak across users.
- `/login`, `/signup` — Turnstile widget state, Auth.js CSRF token, and form fields must never be reused across users.
- `/profile/*` — server-rendered owner check (`session.user.id === user.id`); cached HTML would expose Settings tab to non-owners.

Static paths (`_next/static/*`, OG images, favicons) remain eligible for cache via the origin's `Cache-Control` header — Cloudflare respects `max-age=14400, must-revalidate` from Vercel without any rule.

## Verification

`curl -I` against production, 2026-05-20 just after deploy:

| Path | `cf-cache-status` | Expected | Pass |
|---|---|---|---|
| `/` | DYNAMIC | DYNAMIC (CF default for HTML) | ✓ |
| `/api/stats` | DYNAMIC | Bypassed | ✓ |
| `/api/leaderboard?mode=single` | DYNAMIC | Bypassed | ✓ |
| `/login` | DYNAMIC | Bypassed | ✓ |
| `/signup` | DYNAMIC | Bypassed | ✓ |
| `/profile/me` | DYNAMIC | Bypassed | ✓ |
| `/leaderboard` (page) | DYNAMIC | DYNAMIC (CF default) | ✓ |
| `/_next/static/.../*.css` | MISS (then HIT) | Cacheable | ✓ |

All 8 cases produced expected behavior. `cf-ray` is present on every response, confirming the proxy is in front of every request.

## Defense layers (final, end-to-end)

```
Browser
  ↓ HTTPS (TLS 1.2+)
Cloudflare Edge (BKK)
  ├─ DDoS protection (always-on)
  ├─ Bot Fight Mode (challenges known bot patterns)
  ├─ Block AI bots (managed rule)
  ├─ Cache Rules: bypass /api/*, /login, /signup, /profile/*
  ↓ SSL Full (strict)
Vercel
  ├─ WAF: rate-limit /api/score, exploit-probe deny, signup-log
  ↓
Next.js function
  ├─ Turnstile (signup + Credentials login)
  ├─ isSameOrigin CSRF guard (/api/score, /api/auth/signup, /api/profile/settings)
  ├─ Upstash rate limits: signup 5/60s fail-closed, settings 10/60s, pw 3/300s fail-closed, events 10/60s
  ├─ Proof-of-play token (/api/score)
  ├─ Auth.js JWT (HttpOnly + Secure + SameSite=Lax)
  ├─ Soft-delete + isNull(deletedAt) gate on every users read
  ↓
Neon Postgres (HTTPS, parameterized via Drizzle) + Upstash Redis (HTTPS REST)
```
