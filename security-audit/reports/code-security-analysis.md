# Source Code Security Analysis

Scope: every TypeScript file under `src/`. Findings are tagged `C-NN` (Code) and graded Critical / High / Medium / Low / Info.

---

## C-01 — MediaPipe WASM loaded from CDN without Subresource Integrity

### Severity
**High**

### Affected files
- `src/lib/mediapipe.ts:32-33`
- transitively: `src/components/game/CameraFeed.tsx` (loop runs the loaded WASM against live camera frames)

### Description
`loadHolistic()` resolves every MediaPipe asset (WASM binary, JS shim, solution JSON) from `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}` via `holistic.locateFile(...)`. The exact tag `0.5.1675471629` is pinned, but there is no Subresource Integrity (SRI) hash, no Permissions-Policy lock-down on `script-src`, and no Content Security Policy at all.

### Root cause
MediaPipe is loaded dynamically by `@mediapipe/holistic` itself — `import('@mediapipe/holistic')` returns a class whose constructor calls `locateFile(...)` to fetch WASM and helper scripts at runtime. The npm package is just a thin loader; the actual bytes live on jsdelivr.

### Risk scenario
Tampering with the pinned artifact on jsdelivr (or a route hijack against the CDN domain) executes attacker-controlled JavaScript in the page's main origin. That code has:
- access to the live `<video>` element (camera frames),
- access to `document.cookie` for any non-HTTP-only cookies and `localStorage`/`sessionStorage`,
- ability to fetch `/api/*` with the authenticated session cookie (because the cookie is sent from same-origin scripts).

This is a classic third-party JS supply chain compromise. The pinned URL reduces but does not eliminate the risk — a compromised CDN can serve different bytes for the same URL.

### Evidence
```ts
// src/lib/mediapipe.ts:29-34
async function _loadHolisticInner(): Promise<Holistic> {
  const { Holistic } = await import('@mediapipe/holistic')
  const holistic = new Holistic({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
  })
```

### Recommended fix
1. **Preferred**: self-host the MediaPipe WASM bundle in `public/mediapipe/<version>/` and point `locateFile` at a same-origin path. Eliminates the cross-origin trust dependency entirely.
2. **Alternative**: add a Content Security Policy that restricts `script-src` to `'self'` plus the exact jsdelivr CDN, and a `worker-src` directive constraining WASM origins, then add a SRI-style integrity check by:
   - Adding a SHA-384 manifest file shipped at build time, and verifying each fetched `.js`/`.wasm` chunk before passing it to the WASM compiler. This is non-trivial because MediaPipe owns its own fetcher.
3. **Defense in depth**: add CSP `Trusted-Types` for the document, even if it doesn't cover WASM.

### References
- OWASP Top 10 2021 A06:2021 — Vulnerable and Outdated Components
- CWE-829 — Inclusion of Functionality from Untrusted Control Sphere
- OWASP A08:2021 — Software and Data Integrity Failures
- Next.js docs on CSP and `Content-Security-Policy`

---

## C-02 — Weak randomness in username generation (Math.random)

### Severity
**Low**

### Affected files
- `src/auth.ts:65` — `Math.random().toString(36).slice(2, 6)` builds the random suffix on Google first-time signup
- `src/app/api/auth/signup/route.ts:15-18` — `Math.random()`-derived numeric suffixes for username collision suggestions
- `src/app/api/profile/settings/route.ts:18-20` — same suggestion path
- `src/components/game/GameTimer.tsx:65` — `Math.random()` for the random WAIT-→GO delay (purely game UX, not security)

### Description
`Math.random()` is a pseudo-random generator that is **not** cryptographically secure. Browsers and Node both implement it as Xorshift / xoshiro variants seeded from time. Outputs are predictable to an attacker who can observe a small number of samples.

### Root cause
Convenience choice. `crypto.randomUUID()` is already in use elsewhere in the codebase (`src/app/api/score/route.ts:83`) so the alternative is available.

### Risk scenario
- **auth.ts**: when a new Google user signs up the username becomes `${base}_${4 random chars}`. If `base` is predictable (it usually is — derived from `profile.name`), an attacker who can race the signup can pre-register the predicted username on `/api/auth/signup` (credentials) and capture the namespace. Race window is roughly the time between Google redirect callback and the INSERT. Real impact bounded by the requirement that the attacker knows the victim's incoming profile.name and beats the JWT callback to the DB.
- **signup suggestions**: only displayed back to the same user; suggestion guessing has no payoff.
- **GameTimer**: pure UX, no impact.

### Recommended fix
Replace with `crypto.getRandomValues()` or `crypto.randomUUID()`-derived suffixes:

```ts
// src/auth.ts:65 — replacement
const suffix = crypto.randomUUID().slice(0, 4)
const username = `${base}_${suffix}`
```

For `suggestUsernames` in signup + settings, also seed with `crypto.getRandomValues(new Uint32Array(1))[0]` and modulo to the desired range.

### References
- MDN: `Math.random()` is **not** cryptographically secure
- CWE-338 — Use of Cryptographically Weak Pseudo-Random Number Generator

---

## C-03 — JSON-in-Redis member: trust on the encode side only

### Severity
**Info**

### Affected files
- `src/app/api/score/route.ts:94` (streak) and `:160` (single)
- `src/app/api/leaderboard/route.ts:56`
- `src/lib/rename-leaderboard.ts:38-45`

### Description
Score snapshots are stored as JSON strings inside Redis sorted set members. On submission the server builds the JSON with controlled values (username already validated). On read, `JSON.parse(rawMember)` returns objects that the API merges into HTTP responses.

### Root cause
This is by design — Redis sorted sets do not store structured documents. The team chose JSON-in-member because:
- `automaticDeserialization: false` is set on the Upstash client (intentional, per CLAUDE.md).
- All writes are server-side; all member text is built by server code.

### Risk scenario
A poisoned member (only producible by code with direct Redis access — i.e., script tooling or a compromised function instance) would cause `JSON.parse` to either throw (handled in `rewrite-leaderboard`) or return an object with arbitrary fields. The `/api/leaderboard` handler spreads `...s` into the response (`src/app/api/leaderboard/route.ts:74`), so an unexpected extra field (`userId="<script>"`, etc.) leaks downstream. React's default text rendering escapes it, but the `userId` is also used in a DB `inArray(users.id, userIds)` lookup, where a malformed value would be a Postgres type error (`uuid` cast), aborting the request.

### Recommended fix
1. Type the parsed member with `zod` (or a small hand-rolled validator) before merging into HTTP responses.
2. Filter to a known set of keys: `{ id, userId, username, time_ms, count, mode, created_at, country }` only.
3. Reject members where `userId` is set but is not a UUID.

This converts "trusted internal format" into "validated internal format" — defense in depth.

### References
- OWASP A08:2021 — Software and Data Integrity Failures
- CWE-502 — Deserialization of Untrusted Data (here the writer is trusted; this is defensive validation)

---

## C-04 — JWT background DB sync runs unbounded queries per authenticated request

### Severity
**Medium**

### Affected files
- `src/auth.ts:106-123`

### Description
Every authenticated request runs through `jwt()` (Auth.js v5 middleware path). The "background sync" block re-queries `users.username` whenever `Date.now() - token.dbCheckedAt > 5_000`. With many concurrent authenticated requests the function fan-outs N parallel Postgres reads.

### Root cause
The 5-second staleness window keeps usernames fresh after a rename without an explicit client `session.update()` (per `MEMORY.md` — `jwt_throttled_db_sync.md`). The trade-off: 1 extra DB round trip per session every 5 s.

### Risk scenario
- A single user can issue ~12 DB queries per minute just by hitting authenticated endpoints rapidly.
- Multiplied across users this is a Postgres-side amplification.
- On a DB outage the catch-and-log keeps the JWT alive but logs error spam.

### Recommended fix
1. **Tag-based invalidation**: replace polling with a `usernameChangedAt` lookup keyed in Redis (set by the rename endpoint), expire after 30 s. JWT reads a Redis `GET` instead of a Postgres query — cheaper.
2. **Increase staleness window** to 30 s if the rename UI already calls `session.update()` (it does — `src/components/profile/SettingsTab.tsx:86`).
3. **Skip on read-only routes**: pass a flag through `auth()` callsites to disable background sync where freshness isn't needed.

### References
- OWASP A04:2021 — Insecure Design
- CWE-405 — Asymmetric Resource Consumption (Amplification)

---

## C-05 — `crypto.randomUUID` server-built score ID inside JSON member — no integrity check on read

### Severity
**Info**

### Affected files
- `src/app/api/score/route.ts:83, 94, 160`

### Description
The score `id` is a server-generated UUID embedded in the Redis JSON. The DB row also has its own UUID (`scores.id`, from Drizzle's `defaultRandom()`). The two UUIDs do not match — the Redis JSON's `id` is **not** the same as the DB row's `id`.

### Root cause
The DB `INSERT` does not pass the in-memory `id`; Drizzle generates a new UUID on the DB side. The Redis-side `id` was meant for client UI keying.

### Risk scenario
No direct security issue, but this complicates correlation between leaderboard entries and DB rows. A future feature that joins them by `id` would silently fail.

### Recommended fix
Pass the same UUID to both stores:

```ts
await db.insert(scoresTable).values({ id, userId, ... })  // <-- add id
```

### References
- Internal data integrity hygiene.

---

## C-06 — `setInterval(2000)` SSE handler keeps a Redis poll loop per connection

### Severity
**Low**

### Affected files
- `src/app/api/events/route.ts:39-53`

### Description
Each `/api/events` SSE connection starts a `setInterval(..., 2000)` that polls Redis (`GET lb:stats:plays`). With 100 concurrent viewers that's 50 Redis ops/s baseline before any actual plays.

### Root cause
SSE primitives in Next.js don't ship with built-in pubsub. Polling is acceptable for a low-update counter.

### Risk scenario
- Cost amplification (Upstash bills per op).
- Connection storm from broken clients could drive Redis cost during an incident.
- The rate-limit (10 connections / minute / IP) caps the worst case at ~10 ops/min/IP per attacker, but a botnet bypasses this.

### Recommended fix
1. **Switch to Upstash Pubsub** or **Vercel KV pub/sub**: `/api/score` publishes a tick on submission; `/api/events` subscribes. Removes the polling loop entirely.
2. **Coalesce polls**: cache the last `lb:stats:plays` value in process memory for 1 s, so concurrent SSE handlers on the same warm instance share one Redis read per second.
3. **Reduce poll frequency** from 2 s to 5 s — the counter UI doesn't need sub-2-second resolution.

### References
- Performance / cost issue, not a security vulnerability per se, but a DoS-amplification surface.

---

## C-07 — `process.env.VERCEL === '1'` is the only fail-closed signal for missing client IP

### Severity
**Low**

### Affected files
- `src/lib/ratelimit.ts:53-60`

### Description
`clientIpOrFail(req)` throws if `VERCEL === '1'` and the request lacks `x-forwarded-for` and `x-real-ip`. Otherwise it returns `'dev-local'`. If the project is ever deployed to a non-Vercel host the fallback string `'dev-local'` becomes a single rate-limit bucket shared by every attacker.

### Root cause
Environment-specific check hard-coded.

### Risk scenario
Migration to a different host (Cloudflare, Render, Railway) without updating `clientIpOrFail` would silently disable IP-keyed rate limiting.

### Recommended fix
Use `NODE_ENV === 'production'` as the gate, plus an explicit `PRODUCTION_REQUIRES_IP` env that is set to `'1'` regardless of platform.

### References
- OWASP A04 — Insecure Design (environmental coupling).

---

## C-08 — `x-forwarded-for` is parsed verbatim (`split(',')[0]`)

### Severity
**Low** (acceptable given Vercel injects this header)

### Affected files
- `src/lib/ratelimit.ts:40-48`

### Description
`clientIp(req)` reads `x-forwarded-for`, splits on `,`, takes the first token. On Vercel this is the originating client IP. On any other infra it would be spoofable.

### Root cause
Single-platform deployment.

### Risk scenario
Same as C-07 — host migration risk.

### Recommended fix
On Vercel use `req.headers.get('x-real-ip')` first (Vercel sets this to the **untrusted-chain** original IP); if missing, parse `x-forwarded-for` only when running on Vercel. Document the assumption in `csrf.ts` or a `lib/runtime.ts` helper.

---

## C-09 — `csrf.ts` has dead code in the host whitelist

### Severity
**Info**

### Affected files
- `src/lib/csrf.ts:20-24`

### Description
The block `if (ALLOWED_HOSTS.has(host) || host.endsWith('.vercel.app') || host.endsWith('.vercel.dev')) { /* continue to source check below */ }` has an empty body — it does not gate anything. The actual logic is the `url.host === host` comparison below, which makes this whitelist a no-op.

### Risk scenario
Misleading code. Future maintainers may think `vercel.app` is treated specially when it isn't.

### Recommended fix
Delete the block, or use it to actually allow preview deployments by short-circuiting `return true` when the request host matches a known preview domain pattern.

```ts
const host = req.headers.get('host')
if (!host) return false
const candidate = req.headers.get('origin') ?? req.headers.get('referer')
if (!candidate) return true  // non-browser client; rely on auth + rate limit
try {
  return new URL(candidate).host === host
} catch {
  return false
}
```

### References
- Code hygiene; no behavior change.

---

## C-10 — `isSameOrigin` returns `true` when both Origin and Referer are absent

### Severity
**Medium**

### Affected files
- `src/lib/csrf.ts:25-31`

### Description
When `origin` and `referer` are both absent, the function returns `true`, on the rationale that browsers always send at least one for cross-origin POSTs. The comment notes: "Non-browser clients (curl, server-to-server) typically omit both. We accept them — abuse there is handled by rate limiting + auth."

### Risk scenario
- For `/api/score` POST, **anonymous submissions are accepted** (no `auth()` required). Combined with this CSRF behavior, an attacker can POST scores from any non-browser client (curl, scripted bot, fetch from a worker that strips headers).
- Vercel WAF rule (rate-limit 30/60s/IP) caps the volume per IP. IP rotation defeats it.
- Effective consequence: leaderboard score spam / integrity loss. There is no proof-of-play; a fully fake JSON body with `time_ms=100` is accepted.

### Recommended fix
**Don't loosen the CSRF check** — the comment is correct that this is intentional. Instead, treat the **anonymous score-submission path itself** as the threat surface (see API report **A-02**) and require either:
- a server-issued proof-of-play token (HMAC-signed nonce vended at game start, replay-protected),
- or require sign-in for any score submission.

The CSRF check should additionally **reject** when Origin and Referer are both absent **for state-mutating endpoints when the caller is authenticated** (the auth token is enough; a script-with-cookie is a CSRF attempt by definition). This is a minor tweak:

```ts
const candidate = origin ?? referer
if (!candidate) {
  // Allow if request is unauthenticated; the rate-limit + score-validator gates apply.
  // For authenticated requests, require Origin/Referer.
  return !req.headers.get('cookie')?.includes('authjs.session-token')
}
```

### References
- OWASP A01:2021 — Broken Access Control (CSRF subcategory)
- CWE-352 — Cross-Site Request Forgery

---

## C-11 — DELETE account does not invalidate the Auth.js JWT

### Severity
**Medium**

### Affected files
- `src/app/api/profile/settings/route.ts:181-196`
- `src/auth.ts:106-123` (JWT callback continues to query the now-deleted user row)

### Description
`DELETE /api/profile/settings` removes the user row but does not signal Auth.js to invalidate or rotate the cookie. The cookie remains valid until natural expiry. The JWT callback's background DB sync silently catches `dbUser is undefined` (line 117: `if (dbUser) token.username = dbUser.username`), so the JWT becomes a "ghost" token: still cookie-valid, decrypts successfully, but the user is gone.

### Risk scenario
- After deletion, `session?.user?.id` is still set on the client. Pages like `ProfileCard.tsx` will fetch `/api/profile/me` which returns 404 — the UI degrades but doesn't sign the user out. A returning attacker who stole the cookie before deletion can still authenticate against any endpoint that only checks `session.user.id` against the DB — most do (good) — but the **flow is undefined**.
- Worse, the ghost JWT can still POST to `/api/score` as authenticated. The score handler resolves the username from `users.id = session.user.id`, which returns no rows → 401 ("User not found"). So the score path is OK, but conceptually the session should not be valid.

### Recommended fix
1. After `db.delete(users)`, call `signOut()` from the route handler (Auth.js v5 supports this server-side) and/or set `Set-Cookie: authjs.session-token=; Max-Age=0; ...` to expire the cookie.
2. Optionally maintain a "tombstone" table or Redis set of deleted `user.id` values for 24 h; the JWT callback rejects tokens whose `id` is in the tombstone.

```ts
// at end of DELETE
import { cookies } from 'next/headers'
const cs = await cookies()
cs.delete('authjs.session-token')
cs.delete('__Secure-authjs.session-token')
return NextResponse.json({ ok: true })
```

### References
- OWASP A07:2021 — Identification and Authentication Failures
- CWE-613 — Insufficient Session Expiration

---

## C-12 — Race condition in signup uniqueness checks

### Severity
**Low**

### Affected files
- `src/app/api/auth/signup/route.ts:70-87, 94`

### Description
Email and username uniqueness are checked with two SELECTs before the INSERT. Two parallel signups with the same email or username can both pass the SELECT, then one INSERT fails with a Postgres unique-violation error (uncaught). The route returns a generic 500 to the user instead of `409 Email already registered`.

### Risk scenario
Edge case; consequence is bad UX during a thundering-herd, not security.

### Recommended fix
Wrap the `INSERT` in a try/catch for unique violation (Postgres `23505`) and rethrow as a 409:

```ts
try {
  const [user] = await db.insert(users).values(...).returning(...)
  return NextResponse.json({ id: user.id, username: user.username }, { status: 201 })
} catch (e: any) {
  if (e?.code === '23505') {
    return NextResponse.json({ error: 'Email or username already taken' }, { status: 409 })
  }
  throw e
}
```

### References
- CWE-362 — Concurrent Execution using Shared Resource with Improper Synchronization

---

## C-13 — Account deletion leaves Redis leaderboard snapshots untouched

### Severity
**Medium**

### Affected files
- `src/app/api/profile/settings/route.ts:181-196`

### Description
`DELETE /api/profile/settings` removes the `users` row. The schema FK is `ON DELETE SET NULL`, so `scores.user_id` becomes null but the row stays. Redis sorted-set members keep the deleted user's `username` and `userId` baked into the JSON snapshot. A new user can later register the same username (after the unique constraint frees), and the leaderboard entries — which the UI links to `/profile/<username>` — now point at the new account.

The route's own comment acknowledges this: "Redis leaderboard members are left untouched, so the leaderboard continues to show the original username after the account is gone."

### Risk scenario
Impersonation via account-recycle. User A scores #1, deletes account → User B registers `userA` → leaderboard renders #1 with a profile link to User B. Reputation transfer.

### Recommended fix
1. Reserve the username for N days after deletion (add `deletedAt` to `users` and keep the row; reject signup if `users.username = X AND deletedAt > now() - 30 days`).
2. On deletion, mark the leaderboard members as `userId: null, username: <username> [deleted]` so the UI can flag them.
3. Or, on signup, scan `users` for a soft-deleted match before accepting the username.

### References
- OWASP A04:2021 — Insecure Design
- CWE-285 — Improper Authorization

---

## C-14 — Profile history endpoint accepts any string as `cursor`

### Severity
**Low**

### Affected files
- `src/app/api/profile/[username]/history/route.ts:31-33`

### Description
`cursor` is parsed with `new Date(cursor)`. An invalid string yields `Invalid Date`, which `drizzle-orm`'s `lt(scores.createdAt, new Date(cursor))` then converts to a Postgres `timestamp` parameter. Postgres rejects it as an invalid input, raising a 500.

### Recommended fix
Validate before query:

```ts
if (cursor) {
  const d = new Date(cursor)
  if (Number.isNaN(d.getTime())) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
  }
  conditions.push(lt(scores.createdAt, d))
}
```

### References
- CWE-20 — Improper Input Validation

---

## C-15 — `Math.random` for game timer delay (informational)

### Severity
**Info**

### Affected files
- `src/components/game/GameTimer.tsx:65`

### Description
The 1–3 s random delay before the "GO" signal uses `Math.random()`. This is the right call for UX; a CSPRNG here would be overkill. Documented as Info because the anti-cheat surface for the reaction time itself relies on the unpredictability of this delay.

### Risk scenario
A sophisticated attacker observing many sessions could in theory model the PRNG. In practice, the timer starts on a per-page-load seed and the attacker needs to win by ~milliseconds, which is below the user-action latency floor anyway. **No action recommended.**

---

## C-16 — `console.error` used for production error logging

### Severity
**Info**

### Affected files
- 7 callsites in `src/app/api/**/route.ts` and `src/auth.ts`

### Description
Error paths log via `console.error` only. On Vercel this surfaces to platform logs, which is fine. No structured logger, no PII redaction; this is acceptable for the project's current scale.

### Recommended fix
When traffic grows: wrap with a `logError(scope, err, meta)` helper that:
- Redacts `password`, `email`, `passwordHash`, `cookie`, `authorization` keys recursively.
- Adds a request ID for correlation.
- Routes to Vercel Log Drains.

### References
- OWASP A09:2021 — Security Logging and Monitoring Failures

---

## C-17 — Password policy is "minimum 8 characters" with no composition rule

### Severity
**Low**

### Affected files
- `src/app/api/auth/signup/route.ts:66-68`
- `src/app/api/profile/settings/route.ts:152-153`

### Description
NIST SP 800-63B explicitly says do **not** require composition rules and **do** allow long passphrases — but it also recommends a deny-list of compromised passwords (HIBP API or local list).

### Recommended fix
- Bump minimum length to 10 characters (or keep 8 with the deny-list).
- Add HIBP k-anonymity check via `https://api.pwnedpasswords.com/range/<5 hex>` — only the first 5 chars of SHA-1 leave the server; the response contains hashes for all matches. Reject if found.
- Cap max length at 128 to avoid bcrypt internal truncation surprises (bcrypt itself truncates at 72 bytes).

```ts
if (password.length < 10 || password.length > 128) {
  return NextResponse.json({ error: 'Password must be 10–128 characters' }, { status: 400 })
}
const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
const prefix = sha1.slice(0, 5)
const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
const text = await res.text()
if (text.toUpperCase().includes(sha1.slice(5))) {
  return NextResponse.json({ error: 'This password appears in known breaches' }, { status: 400 })
}
```

### References
- NIST SP 800-63B §5.1.1.2
- OWASP ASVS L1 — V2.1.7 (compromised password check)
