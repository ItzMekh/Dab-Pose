# Session Finale — 2026-05-18 to 2026-05-20

**Audit start**: 2026-05-18
**Sprint end**: 2026-05-20
**Commits on `main`**: 26
**Source files touched**: ~30 (every API route, every auth-adjacent component, every `lib/*` helper)
**Source LOC delta**: +1100 production, +6500 audit deliverables, +35 MB self-hosted MediaPipe assets
**Migration applied**: `drizzle/0001_users_deleted_at.sql` (Neon production)
**External services configured**: Cloudflare zone `dabpose.fun` (DNS, SSL, Bot Fight, Cache Rules, Turnstile), Vercel WAF dedup, Vercel env vars

## Findings closure ledger

### High (4 / 4 closed)

| Tag | Title | Closing commit |
|---|---|---|
| C-01 / F-04 / DP-04 | MediaPipe WASM no SRI | `985ac26` self-host |
| F-01 | No CSP | `3e2784a` headers |
| F-02 | No X-Frame-Options | `3e2784a` headers |
| A-01 | Anonymous score forgery | `af1a13b` proof-of-play |

### Medium (9 / 10 closed)

| Tag | Title | Closing commit |
|---|---|---|
| F-03 | No HSTS in-app | `3e2784a` headers |
| F-11 | No Permissions-Policy | `3e2784a` headers |
| AU-02 | No bot challenge | `dbcf9bc` + `87e211a` Turnstile |
| AU-03 / DP-03 | next-auth caret on beta | `2edb273` pin exact |
| C-04 | JWT background DB sync amplification | `c60c63b` Redis tag |
| C-10 | CSRF returns true on missing Origin | `4162938` stricter |
| C-11 | DELETE doesn't invalidate JWT | `eb77f20` cookie clear |
| C-13 | Account-recycle impersonation | `eb77f20` soft-delete |
| DP-02 | Next.js 15 → 16 lag | PR #4 `67cba98` |
| I-01 | Missing platform headers | `3e2784a` |
| I-06 | Vercel WAF visibility | `9df174e` dedup |
| **AU-01** | **No email verification** | **OPEN — needs email provider choice** |

### Low (9 / 12 closed)

| Tag | Title | Closing commit |
|---|---|---|
| C-02 | Math.random in username gen | `cf29c28` |
| C-08 | x-forwarded-for parsed verbatim | `2b7dfec` CF-Connecting-IP first |
| C-12 | Signup INSERT race | `e4aae19` unwrap err.cause.code |
| C-14 | History cursor not validated | `cf29c28` |
| C-17 | Password 8-char + no breach check | `a1d8937` HIBP |
| A-08 | No CSRF on signup | `2edb273` |
| AU-07 / F-05 | Avatar img no referrerPolicy | `2edb273` |
| AU-08 | Auth.js default error page leaks codes | `3baadf3` pages.error |
| AU-10 | Username regex mismatch | `cf29c28` |
| DP-05 | Unused @mediapipe/camera_utils + drawing_utils | `2edb273` uninstalled |
| DP-06 | No Node engine pin | `cf29c28` |
| C-06 C-07 A-02 A-04 AU-11 | Remaining Low | **deferred** |

### Info (added closures)

| Tag | Title | Closing commit |
|---|---|---|
| C-03 | Redis member validation | `3baadf3` zod |
| C-16 | console.error production logging | `9108f2f` logError helper |
| I-07 | No pre-commit secret scan | `9108f2f` husky + gitleaks |
| A-05 | x-vercel-ip-country trust | `2b7dfec` + `69909b6` |

## Cloudflare configuration locked in

- Zone `dabpose.fun` activated 2026-05-20 02:04 UTC
- SSL/TLS = Full (strict), Min TLS = 1.2
- Bot Fight Mode = On
- Block AI bots = On
- Cache Rule "Bypass cache for dynamic + auth paths"
- Turnstile widget: site `dabpose.fun`, real keys in Vercel env

## Vercel state

Env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` — all set in Production scope.

Vercel WAF rules:
1. ~~Rate limit `/api/score` POST 30/60s~~ — **Disabled** (CF dedup)
2. Block exploit probes — Deny
3. Log signup POSTs — Log

## Migration

`drizzle/0001_users_deleted_at.sql`:
```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
```
Applied 2026-05-19 via `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate`.

## Outstanding owner action

| # | Item | Estimated effort |
|---|---|---|
| 1 | Choose an email provider and wire AU-01 verification | ~3 hours code |
| 2 | `brew install gitleaks` so the pre-commit hook enforces locally | 1 minute |
| 3 | Periodic sanity check via `vercel firewall rules ls` | recurring |

## Backup files

`security-audit/backup/` contains 50+ `.bak*` copies of every source file touched. Per-fix rollback: `cp security-audit/backup/<file>.<tag> <original-path>`.
