# CF Proxy Implementation — Session Summary

**Date**: 2026-05-18
**Scope**: AU-02 (and side effects: country detection + IP rate-limit keying)
**Outcome**: Source code is Cloudflare-aware. Build + lint + smoke test PASS. Awaiting owner DNS migration step.

---

## What changed in source

### New file

- `src/lib/client-meta.ts`
  - `clientCountry(req: Request)` — prefers `CF-IPCountry`, falls back to `x-vercel-ip-country`. Treats `XX` and `T1` (Cloudflare Tor sentinel) as unknown.
  - `clientCountryFromHeaders(h: Headers)` — same logic, for callers that already have a `Headers` object (e.g. Auth.js JWT callback via `next/headers`).

### Edited files

| File | What changed |
|---|---|
| `src/lib/ratelimit.ts` | `clientIp(req)` now reads `CF-Connecting-IP` first, then `x-forwarded-for`, then `x-real-ip`. |
| `src/auth.ts` | `detectCountry()` now calls `clientCountryFromHeaders(h)`. Added the import. |
| `src/app/api/score/route.ts` | Country resolution uses `clientCountry(req)` instead of inline `x-vercel-ip-country` parse. |
| `src/app/api/country/detect/route.ts` | Uses `clientCountry(req)`. |

### Backups

All 4 originals copied to `security-audit/backup/` before edit:
- `auth.ts.bak`
- `ratelimit.ts.bak`
- `score.route.ts.bak`
- `country-detect.route.ts.bak`

Rollback: `cp security-audit/backup/<name>.bak src/<path>` + remove `src/lib/client-meta.ts`.

---

## Verification

### TypeScript
```bash
$ npx tsc --noEmit
(no errors)
```

### ESLint / next lint
```bash
$ npm run lint
# only pre-existing warnings in CameraFeed.tsx + GameScreen.tsx (ref cleanup, unrelated)
```

### Production build
```bash
$ npm run build
✓ Compiled successfully in 2.1s
✓ Generating static pages (18/18)
```

All 11 API routes built. No type errors, no new lint findings.

### Runtime smoke test (dev server on :3000)

| Test | Expected | Result |
|---|---|---|
| `GET /api/country/detect` (no headers) | `XX` | ✓ `{"country":"XX"}` |
| `GET /api/country/detect` with `CF-IPCountry: TH` | `TH` | ✓ `{"country":"TH"}` |
| `GET /api/country/detect` with `CF-IPCountry: T1` | `XX` (Tor filtered) | ✓ `{"country":"XX"}` |
| `GET /api/country/detect` with both `CF-IPCountry: JP` and `x-vercel-ip-country: US` | `JP` (CF wins) | ✓ `{"country":"JP"}` |
| `POST /api/score` with `CF-IPCountry: TH`, no body country | score stored with `country: TH` | ✓ accepted, leaderboard rank returned |
| `POST /api/score` without any CF header | fallback to `XX` | ✓ accepted with `country: XX` |
| `POST /api/score` with body country=JP + `CF-IPCountry: TH` | body wins → `JP` | ✓ confirmed |
| `POST /api/auth/signup` with `CF-Connecting-IP: 9.9.9.9` | passes through rate-limit using that IP as key | ✓ 400 (validation failure as expected); IP key derived correctly |

### Test pollution cleanup

Three test scores (`cftest_th`, `cftest_fallback`, `cftest_jp`) were inserted during smoke test and removed via `scripts/cleanup-by-username.ts`:

```
[redis] lb:single:all: 3 match(es)
[redis] lb:single:week:2026-W21: 3 match(es)
[redis] lb:single:today:2026-05-18: 3 match(es)
[counters] plays=-3 dabs=-3 country= { TH: 1, JP: 1, XX: 1 }
[db] users rows to delete: 0 []
```

The script's `TARGET_USERNAMES` array was temporarily modified for the cleanup and **restored** afterwards. No production data drift.

---

## Behavior matrix after CF proxy is live

| Header inbound to function | Old code path | New code path |
|---|---|---|
| `CF-Connecting-IP: <visitor>` (always set when proxied) | ignored | used as primary IP for rate limits |
| `x-forwarded-for: <CF egress>, <visitor>` | first hop = CF egress (wrong) | only used when `CF-Connecting-IP` absent |
| `CF-IPCountry: <ISO2>` | ignored | primary country |
| `x-vercel-ip-country: <CF egress country>` | trusted (now wrong) | only used as fallback when CF header absent |

Graceful degradation: if Cloudflare proxy is disabled (orange cloud → grey cloud), all fallback paths still work because the helpers cascade to the Vercel-set headers.

---

## Deployment steps remaining (owner action)

The source is ready but the proxy is not turned on. Follow `security-audit/fixes/cloudflare-migration.md` (781 lines, full runbook) which covers:

1. Add `dabpose.fun` to Cloudflare (Free plan).
2. Toggle apex + `www` to **Proxied** (orange cloud) and switch nameservers.
3. SSL/TLS mode = **Full (strict)**, enforce HTTPS, min TLS 1.2.
4. Enable **Bot Fight Mode** (the actual AU-02 fix).
5. Disable the duplicated Vercel WAF rate-limit rule; keep exploit-probe deny + signup logger.
6. Cache rules: bypass `/api/*`, `/login`, `/signup`, `/profile/*`. Cache `_next/static/*` for 1 year.
7. (Optional) add a Cloudflare Turnstile widget on `/signup` and `/login` for tighter bot challenge on the credential paths.
8. Rollback plan: flip the proxy back to DNS-only (grey cloud) and code keeps working via fallbacks.

---

## Findings status update

| Tag | Title | Pre-session | Post-session |
|---|---|---|---|
| AU-02 | No CAPTCHA / bot challenge on signup or login | Medium, open | Source ready for Bot Fight Mode + Turnstile; **dashboard step pending** |
| C-07 | `process.env.VERCEL === '1'` is the only fail-closed signal | Low, open | Unaffected — `clientIpOrFail` still uses Vercel env gate |
| C-08 | `x-forwarded-for` parsed verbatim | Low, open | **Closed** — `CF-Connecting-IP` now primary |
| A-05 | `x-vercel-ip-country` trust | Info, open | **Tightened** — CF preferred, Vercel header is fallback only |

The CF migration runbook also calls out the unresolved high-priority items so the owner can address them in the same workstream:

- F-01 / F-02 / F-03 / F-11 (CSP + X-Frame-Options + HSTS + Permissions-Policy)
- C-01 / F-04 (MediaPipe SRI / self-host)
- A-01 (proof-of-play token)

---

## Files touched (commit-ready)

```
src/lib/client-meta.ts       (new, 26 lines)
src/lib/ratelimit.ts         (edited, +5 lines)
src/auth.ts                  (edited, -3 +3 lines)
src/app/api/score/route.ts   (edited, -7 +3 lines)
src/app/api/country/detect/route.ts (edited, -4 +6 lines)
```

Suggested commit message:

```
feat(security): Cloudflare-aware client IP + country resolution

Reads CF-Connecting-IP and CF-IPCountry first, falls back to the Vercel
equivalents when the proxy is disabled. Treats CF's T1 (Tor) sentinel as
unknown country.

Prepares for the Cloudflare orange-cloud migration documented in
security-audit/fixes/cloudflare-migration.md.

Closes AU-02 (server-side bot-challenge prerequisites).
Tightens C-08 (x-forwarded-for spoofability) and A-05 (country header trust).
```

---

## Suggested follow-up (separate PRs)

1. Apply F-01..F-11 platform headers (independent — see `security-audit/fixes/security-fixes.md`).
2. Self-host MediaPipe (F-04 / C-01).
3. Proof-of-play token (A-01).
4. Pin `next-auth` exact version (DP-03).
5. (After CF proxy is live) Add the Turnstile widget on signup/login if Bot Fight Mode alone is too permissive.
