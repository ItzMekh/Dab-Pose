# API Security

Tag prefix `A-NN`. Coverage: every route under `src/app/api/**`.

## Endpoint surface

| Path | Methods | Auth | Rate limit | CSRF guard | Notes |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | (Auth.js internal) | none in-app (WAF rule logs signup POSTs) | (Auth.js internal) | NextAuth proxy |
| `/api/auth/signup` | POST | none | 5/60s/IP, **fail-closed** | none | bcrypt cost 12 |
| `/api/score` | POST | optional | WAF rule 30/60s/IP | `isSameOrigin` | accepts anonymous |
| `/api/leaderboard` | GET | none | none | n/a | public read, `s-maxage=10, swr=20` |
| `/api/stats` | GET | none | none | n/a | public read, `s-maxage=30, swr=60` |
| `/api/events` (SSE) | GET | none | 10/60s/IP, fail-open | n/a | 270 s self-close |
| `/api/country/detect` | GET | none | none | n/a | echoes `x-vercel-ip-country` |
| `/api/profile/[username]` | GET | none | none | n/a | public, `no-store` |
| `/api/profile/[username]/history` | GET | none | none | n/a | public, paginated |
| `/api/profile/me` | GET | **required** | none | n/a | self-profile |
| `/api/profile/settings` | PATCH, DELETE | **required** | settings 10/60s/user; pwchange 3/300s/user | `isSameOrigin` | PATCH for username/country/password |

---

## A-01 — Anonymous score submission with no proof-of-play

### Severity
**Medium-High** (integrity, not confidentiality)

### Affected files
- `src/app/api/score/route.ts:23-219`

### Description
The endpoint accepts a POST with `{ time_ms: 100 }` and a regex-valid username. There is no:
- session token,
- HMAC-signed play token,
- replay-protected nonce,
- IP-binding to the game session.

Any client (curl, headless browser, fetch from a different page that has cookies cleared) can post a fabricated reaction time and have it ranked.

### Root cause
By design — anonymous play is allowed for low-friction onboarding.

### Risk scenario
- Leaderboard integrity is fully compromised. Anyone can take #1 forever with `time_ms: 100`.
- Country leaderboard rollups inflate with synthetic plays.
- Total stats counter (`lb:stats:plays`, `lb:stats:dabs`) becomes meaningless.
- Mitigation today: WAF rate-limit (30/60s/IP). Easily bypassed by IP rotation.

### Recommended fix
Issue a **proof-of-play token** at game start:

1. New endpoint `GET /api/play/start` returns `{ token, expiresAt }`. The server stores the token in Redis with `SETEX` for 60 s, value contains the issue time + a per-token salt.
2. The client must POST `/api/score` with that token. The server:
   - Looks it up in Redis (with `GETDEL` so it's single-use).
   - Verifies `time_ms` is within the elapsed window since token issue (≥ MIN_MS, ≤ now - issueTime + small slack).
   - Rejects if missing/expired/already used.

This raises the bar from "trivially scriptable" to "must run a small browser fingerprint". Combine with the existing WAF rule and the impact is meaningful.

### References
- OWASP A04 — Insecure Design
- OWASP ASVS L1 — V13.4.2 (server-side controls for security-sensitive actions)
- CWE-345 — Insufficient Verification of Data Authenticity

---

## A-02 — `/api/leaderboard` has no rate limit and no auth

### Severity
**Low**

### Description
A scraper can `?mode=streak&period=today` once per second, paginating through the full board. Response is cached at the edge for 10 s, so bypass is only feasible during cache invalidation.

### Risk scenario
- Bandwidth / cost; the cache makes this minor.
- The endpoint enriches every entry with `users.username + users.avatarUrl`. If the user table grows, the `inArray` query gets larger.

### Recommended fix
Add a soft Upstash limiter at 60/60s/IP fail-open. Or rely on the existing WAF rule if it covers this path (it currently does not).

### References
- OWASP A04 — Insecure Design

---

## A-03 — `/api/events` SSE — fail-open rate limit

### Severity
**Low**

### Affected files
- `src/app/api/events/route.ts:14-27`

### Description
The `eventsLimiter` runs with `fail-open` semantics — if Redis is down, the limit is skipped. This is the right call (the SSE stream is anti-spam, not a security boundary). However:
- the **cap of 10 connections / minute / IP** is generous for a counter ticker.
- the **client** auto-reconnects (`new EventSource` default) every 3 s when the stream closes, generating tokens fast.

### Risk scenario
Connection exhaustion: 1000 IPs × 10 connections/min = 167 SSE handlers / s, each holding a 2 s `setInterval`. On a single warm function instance with concurrency 5, that's ~33 ticks/s of Redis pressure (Upstash bills per op).

### Recommended fix
- Lower to 3 connections / minute / IP.
- Emit `event: error\ndata: backoff` before closing, so a well-behaved client (the project's own `useRealtimeVersion`) can back off.
- Or migrate to **Vercel Queues** / Pub/Sub (see C-06).

### References
- OWASP A04 — Insecure Design

---

## A-04 — `/api/profile/[username]/history` accepts unauthenticated requests

### Severity
**Low** (privacy)

### Affected files
- `src/app/api/profile/[username]/history/route.ts:1-55`

### Description
Anyone can paginate any user's full score history (time_ms, count, country, rank, createdAt). The profile page itself is public — this is intended behavior.

### Risk scenario
- Country code per play could correlate to traveling habits if the user plays from multiple regions. Minor PII.
- Timestamp pattern reveals playing-hour habits.

### Recommended fix
- Acceptable to keep public, but consider hiding the per-play country (only show on the country-leaderboard rollup, not the personal history).
- Add an in-app setting `profile.history.public` defaulting to `true`, to give the user a way to hide.

### References
- GDPR / privacy hygiene — proportionality.

---

## A-05 — Country header trust on `/api/score` and `/api/country/detect`

### Severity
**Info**

### Affected files
- `src/app/api/score/route.ts:50`
- `src/app/api/country/detect/route.ts:5`

### Description
`x-vercel-ip-country` is read directly. Vercel sets this header at the edge based on IP geolocation; user requests do not (cannot) inject it because Vercel strips inbound copies.

The code already validates with `/^[A-Z]{2}$/` and uppercase normalization. **Pass.**

If the project is ever fronted by a non-Vercel CDN, this header becomes attacker-controlled. Document this dependency in `lib/redis.ts` or `csrf.ts`.

---

## A-06 — Profile update PATCH allows username with no length check before regex (Pass)

The route enforces `USERNAME_RE.test(value)` before any DB read. The regex limits length to 3–20. **Pass.**

---

## A-07 — `/api/score` writes per-submission to Redis (10+ commands per call)

### Severity
**Info** (cost/perf, not security)

### Description
Each score insert runs roughly 15 Redis operations across pipeline `ZADD`, `EXPIRE`, `INCR`/`INCRBY`, `ZINCRBY` for country rollups, plus 5 follow-up reads (`ZCOUNT`, `ZCARD`, three `ZRANK` calls).

That's roughly **15 ops per submission**. Each op on Upstash is one billed unit. Cost discipline only.

### Recommended fix
- Batch the country `ZINCRBY` + `EXPIRE` into a single Lua script via Upstash `SCRIPT LOAD` + `EVALSHA`.
- Or skip the country `EXPIRE` writes on every submission and only set TTL on key creation.

---

## A-08 — Same-origin check rejects authenticated browser clients only

See **C-10** for the detailed analysis. The CSRF check is **enforced on `/api/score` POST, `/api/profile/settings` PATCH+DELETE**. It is **not enforced** on:
- `/api/auth/signup` POST
- `/api/profile/me` GET (auth-gated, low risk)
- `/api/events` GET

Adding `isSameOrigin` to `/api/auth/signup` POST would prevent third-party origins from running drive-by signups from a malicious page where the victim is browsing.

### Recommended fix
Add `isSameOrigin(req)` check at the top of `/api/auth/signup`:

```ts
if (!isSameOrigin(req)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## A-09 — `/api/profile/me` — strict ownership check (Pass)

`session.user.id` is the only lookup key. No path/query parameters used. No IDOR surface.

---

## A-10 — `/api/profile/[username]/route.ts` — public profile read

### Severity
**Info**

### Description
Returns user record (`username`, `avatarUrl`, `country`, `createdAt`) and aggregate stats. No email, no DOB, no PII beyond what the user voluntarily set as their public handle. **Pass.**

---

## A-11 — `score.username` re-derivation on authenticated submissions (Pass)

For authenticated submissions, the server ignores `body.username` and looks up `users.username` via `session.user.id`. This protects against a client-side spoofing attempt. **Pass.**

---

## A-12 — `/api/profile/settings` field handling

### Severity
**Info**

### Description
Three legal `field` values (`username`, `country`, `password`) plus a default 400. The implementation uses string equality, not a switch — fine. The `value` for `password` is the **new** password and `currentPassword` is checked against the stored hash. Correct verb-noun structure.

### Risk scenario
A field-name collision (e.g., a future `field: 'email'`) without a corresponding handler returns 400 by fallthrough. **Pass.**

---

## Recommended API hardening summary

| Action | Where | Why |
|---|---|---|
| Add proof-of-play token issuance + verification | `/api/play/start` (new) + `/api/score` (gate) | A-01 |
| Add `isSameOrigin` to `/api/auth/signup` | route.ts:21 | A-08 |
| Add light limiter to `/api/leaderboard` and `/api/profile/*` GETs | per-route | A-02, A-04 |
| Lower SSE concurrent connection cap | `/api/events` | A-03 |
| Validate cursor as a parseable date | `/api/profile/[username]/history` | C-14 |
| Invalidate JWT on DELETE | `/api/profile/settings` | C-11 |
| Surface 409 on signup unique-violation race | `/api/auth/signup` | C-12 |
