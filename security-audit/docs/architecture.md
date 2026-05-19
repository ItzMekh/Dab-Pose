# Architecture Overview

## 1. Request flow

### A. Score submission (authenticated)

```
Browser
  │  POST /api/score  Content-Type: application/json
  │  Body: { username?, time_ms, mode, count?, country? }
  │  Cookie: __Secure-authjs.session-token (signed JWT)
  ▼
Vercel Edge — WAF
  │  Rule 1: rate-limit POST /api/score @ 30/60s/IP
  │  Strips no headers; passes through to function
  ▼
Function (Fluid Compute, Node 24)
  │  1. isSameOrigin(req) — Origin/Referer host match (csrf.ts)
  │  2. auth() — Auth.js verifies JWT, returns session.user.id
  │  3. JSON.parse body
  │  4. Country resolution: body.country (regex) → x-vercel-ip-country → 'XX'
  │  5. Mode validation (single | streak)
  │  6. If authed:  SELECT username FROM users WHERE id = session.user.id
  │     If guest:   USERNAME_RE test on body.username
  │  7. Numeric validation (time_ms in [100, 30000]; count in [0, 300])
  │  8. crypto.randomUUID() → score id
  │  9. JSON.stringify snapshot → Redis pipeline:
  │       ZADD lb:{mode}:{all,week,today}  +  EXPIRE  +  INCR stats  +  ZINCRBY lb:country:*
  │ 10. 3 parallel reads: ZCOUNT (better), ZCARD (total), ZRANK x3
  │ 11. If authed: INSERT INTO scores (...)
  │ 12. Respond 201 with rank/percentile/isKing
  ▼
Browser ← JSON
```

### B. Sign-in (Google OAuth)

```
Browser → /api/auth/signin/google
  ↓
Auth.js redirects → accounts.google.com
  ↓ (consent)
Google → /api/auth/callback/google?code=...
  ↓
Auth.js exchanges code, fetches userinfo
  ↓
jwt() callback (auth.ts):
  if profile.email matches existing user → set token.id, token.username
  else:
    base = lowercased+stripped profile.name
    username = `${base}_${Math.random().toString(36).slice(2,6)}`   ← Math.random, not crypto
    country = headers['x-vercel-ip-country']
    INSERT INTO users (email, username, googleId, avatarUrl, country)
    set token.id, token.username, token.needsUsernameSetup = true
  ↓
session() callback projects token → session.user.{id, name, needsUsernameSetup}
  ↓
Cookie set, redirect to '/'
```

### C. SSE live counter

```
Browser → GET /api/events  Accept: text/event-stream
  ↓
Function:
  rate-limit (10/60s/IP, fail-open)
  ReadableStream:
    every 2s: GET lb:stats:plays; if changed → emit `data: {v:n}`, else `: ping`
    auto-close after 270s
  ↓
Browser EventSource consumes; on close, browser auto-reconnects (default 3s)
```

## 2. State machine — game core

```
                ┌──────────┐
                │   IDLE   │ ←─────────────────────────────────────┐
                └─────┬────┘                                       │
                      ▼                                            │
                ┌──────────┐                                       │
                │COUNTDOWN │                                       │
                └─────┬────┘                                       │
                      ▼                                            │
            ┌─────────────────┐    arm-raised → cancel timer       │
            │     WAITING     │←────────────────────────┐          │
            └─────┬───────────┘                         │          │
                  │ random delay (1-3s)                 │          │
                  │ dab during waiting → FALSE_START ───┴─→ IDLE   │
                  ▼                                                │
            ┌─────────────────┐                                    │
            │     SIGNAL      │ ── streak mode: dab → SIGNAL (loop)│
            └─────┬───────────┘                                    │
                  │ 3 confirmed frames                             │
                  ▼                                                │
            ┌─────────────────┐                                    │
            │    DETECTED     │                                    │
            └─────┬───────────┘                                    │
                  ▼                                                │
            ┌─────────────────┐                                    │
            │     RESULT      │ ───────────────────────────────────┘
            └─────────────────┘
```

All transitions go through `transition(from, to)` in `src/lib/game-state.ts`. Invalid transitions return `from` silently — a defensive idempotent guarantee.

## 3. Data residency

- **Webcam frames**: never leave the browser; passed straight to MediaPipe in-page.
- **Score data**: Postgres (Neon, regional) + Redis (Upstash, regional).
- **Country code**: derived from `x-vercel-ip-country` (Vercel-injected, not user-trusted); 'XX' on miss.
- **PII**: email + bcrypt password hash + Google profile picture URL stored in `users`.
- **Session JWT**: cookie-only (HTTP-only, signed; default Auth.js cookie attrs).

## 4. Caching layers

| Layer | TTL | Notes |
|---|---|---|
| Vercel CDN / SWR | `s-maxage=10–30, swr=20–60` on `/api/leaderboard`, `/api/stats` | client respects no-store for fresh reads |
| `useCountry` `sessionStorage` | tab-scoped | not auth-bound |
| `useUsername` `localStorage` | persistent | `dab_username` key, not auth-bound |
| `dab_seen_intro` `localStorage` | persistent | tutorial flag |
| JWT background DB sync | min 5 s between reads | username staleness window |

## 5. Background and timed work

- `setInterval(doFetch, 30_000)` on Landing, GlobalCounter, Leaderboard, CountryLeaderboard — refresh on focus + version event.
- `setInterval` 2 s inside the SSE handler; auto-close after 270 s.
- bcrypt hash + compare in main function thread (acceptable on Fluid Compute reused instances).
- Username rename also rewrites Redis leaderboard member snapshots in a single pipeline per key (`rewriteLeaderboardUsername`).

## 6. Failure modes (designed)

- Redis outage → signup + password change return 503 (fail-closed); settings + events fall through (fail-open).
- DB outage in JWT background sync → swallowed log, token reused; the next request will retry.
- MediaPipe load failure → 3 retries with 12 s timeout, then user-visible error fallback in `CameraFeed.tsx`.
- Score submission network error → client retries 2× with 800/1600 ms backoff via `fetchWithRetry`.

## 7. Trust boundary summary

| Boundary | Side that validates | Bypass risk |
|---|---|---|
| Browser ↔ Vercel edge | WAF (regex on path + rate-limit) | High-volume single-IP only — bypassable by IP rotation |
| Vercel edge ↔ Function | Function (auth + Origin + regex) | None on Vercel headers; user-controlled headers re-validated |
| Function ↔ Postgres | Drizzle parameterized | SQL injection — not feasible (ORM) |
| Function ↔ Redis | JSON.stringify on write | Member-content injection — see Report `code-security-analysis.md` §3.4 |
| Function ↔ MediaPipe CDN | None (no SRI) | Supply chain compromise of jsdelivr or the pinned tag would execute attacker JS with camera + DOM access |
| Browser ↔ Google avatar URL | None (raw `<img src>`) | Phishing via crafted avatar URL is bounded by `image/*` content-type but Google CDN itself is trusted |
