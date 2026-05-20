# Dab Pose — Security Audit Master Report

**Project**: Dab Pose (dabpose.fun)
**Audit date**: 2026-05-18
**Auditor**: Claude (Opus 4.7) under explicit owner authorization
**Repository**: `/Users/m3kh/Projects/Dab Pose` (branch `main`, HEAD `ee0dc75`)
**Scope**: full source review + dependency tree

## Executive summary

Dab Pose is a webcam-based reaction-time game built on Next.js 15 + React 19 + Auth.js v5 (beta) + Neon Postgres + Upstash Redis + Vercel Fluid Compute. It has 11 API routes, 70 TypeScript/TSX files in `src/`, and 15 direct production dependencies.

**Overall posture**: The project is **better than typical for its scale**. The most recent hardening session (`SECURITY_FIXES.md`, 2026-05-16/17) closed real CSRF, rate-limit, and fail-closed weaknesses. Drizzle ORM + Auth.js + Upstash sliding window give the project a solid baseline.

The remaining findings cluster in three areas:

1. **Browser-side hardening is missing** — no CSP, no clickjacking protection, no Permissions-Policy. (F-01, F-02, F-03, F-11)
2. **Supply chain via MediaPipe CDN** — the WASM bundle loads from `cdn.jsdelivr.net` without Subresource Integrity. The single highest-impact item. (C-01 / F-04 / DP-04)
3. **Score-submission integrity** — anonymous submission with no proof-of-play makes the leaderboard trivially forgeable. (A-01)

No critical-severity exploitable vulnerability was found.

## Progress — 2026-05-19 (one day after audit)

Closed 22 findings via 9 commits on `main`. **Zero High remain.**

```
af1a13b  security: proof-of-play token — close anonymous score forgery (A-01)
4162938  security: CSRF stricter for authenticated callers (C-10)
c60c63b  security: tag-based JWT username refresh (C-04)
eb77f20  security: soft-delete accounts + invalidate JWT on DELETE (C-11, C-13, D-05)
985ac26  security: self-host MediaPipe Holistic (C-01, F-04, DP-04)
2edb273  security: quick wins bundle (A-08, AU-07, F-05, DP-05, DP-03, AU-03)
3e2784a  security: add CSP + clickjacking + HSTS + Permissions-Policy (F-01, F-02, F-03, F-11, I-01)
74ec4bd  docs(security): audit + Cloudflare migration runbook
2b7dfec  security: Cloudflare-aware client IP + country resolution (C-08, A-05)
```

Verified on production (`curl -I https://dabpose.fun/`) after deploy:

- CSP, X-Frame-Options DENY, HSTS preload, Permissions-Policy, Referrer-Policy, X-Content-Type-Options — all present.
- `/mediapipe/0.5.1675471629/holistic.binarypb` and the WASM bundle serve same-origin (HTTP 200).
- `/api/score` rejects requests without a play token (HTTP 400 "Missing play token").
- `/api/play/start` issues fresh tokens.

Schema migration applied to Neon production: `drizzle/0001_users_deleted_at.sql`.

| Severity | At audit | 2026-05-19 | 2026-05-20 | Closed |
|---|---|---|---|---|
| Critical | 0 | 0 | 0 | — |
| **High** | 4 | **0** ✓ | **0** ✓ | **4** |
| **Medium** | 10 | 4 | **2** | **8** |
| **Low** | 12 | 9 | 8 | 4 |
| Info/Pass | 35 | 36 | 37 | 2 |

### 2026-05-20 — additional closures

- **AU-02** Cloudflare Turnstile widget on signup + Credentials login. Owner provisioned real keys; production rejects dummy tokens.
- **C-12** Signup INSERT 23505 race → 409 (unwraps Drizzle's `err.cause.code`).
- **I-06** Vercel WAF audit. Disabled the duplicate rate-limit rule for `/api/score` POST after CF Bot Fight Mode + DDoS took over volumetric handling at the edge. Exploit-probe deny + signup-log kept.

### Cloudflare migration complete

- Zone `dabpose.fun` activated 2026-05-20 02:04 UTC.
- SSL/TLS = Full (strict).
- Bot Fight Mode = On (Block AI bots also enabled).
- Cache Rules: bypass `/api/*`, `/login`, `/signup`, `/profile/*`.
- All security headers + Turnstile widget verified live through CF anycast.

Remaining items:
- **AU-01** Email verification — needs an email provider choice (Resend / Postmark / Vercel email)
- Low-severity Code items (C-02, C-05, C-06, C-07, C-09, C-14, C-16, C-17) — hygiene queue

### 2026-05-20 — also closed today

- **DP-02** Next.js 15.5.18 → 16.2.6 via PR #4 (squash-merged). Codemod ran 0 file changes. Side fix: lazy-init Neon DB client through a Proxy because Next 16's "collecting page data" build phase evaluates route modules without runtime env, and the previous top-level `neon(process.env.DATABASE_URL!)` threw at build time. Production smoke 8/8 green; CF proxy + Turnstile + soft-delete flows verified.
- **Bundle A (5)** — C-02 CSPRNG username gen, C-09 dead code in csrf.ts, C-14 history cursor validation, AU-10 unified username regex, DP-06 engines.node pinned.
- **Bundle B (1)** — C-17 HIBP k-anonymity password breach check + min length 10 on signup + password change.
- **Bundle C (2)** — C-03 zod-validate Redis members on leaderboard read + rename rewriter, AU-08 Auth.js `pages.error` → `/login` to suppress default `/api/auth/error` info disclosure.
- **Bundle D (2)** — C-16 `logError(scope, err, meta)` helper with PII redaction across 7 callsites; I-07 husky pre-commit hook running `gitleaks protect --staged` (fail-soft when gitleaks not installed).

**Final state**: 0 Critical · 0 High · 1 Medium (AU-01) · 3 Low remaining.

---

## Risk dashboard

| Severity | Count | Items |
|---|---|---|
| **High** | 4 | C-01 / F-04 (MediaPipe SRI), F-01 (CSP), F-02 (X-Frame-Options), A-01 (proof-of-play) |
| **Medium** | 10 | F-03, F-11, AU-01, AU-02, AU-03, C-04, C-10, C-11, C-13, DP-02 |
| **Low** | 12 | C-02, C-05, C-06, C-07, C-08, C-12, C-14, C-17, A-02, A-03, A-04, AU-07, AU-08, AU-10 |
| **Info / Pass** | 23 | (see per-domain reports) |

## Top 10 prioritized fixes

| Rank | Fix | Effort | Risk reduced |
|---|---|---|---|
| 1 | Add CSP + X-Frame-Options + HSTS + Permissions-Policy in `next.config.ts` | ~1 hour, careful CSP testing | F-01, F-02, F-03, F-11 (4 High/Medium findings) |
| 2 | Self-host MediaPipe WASM under `public/mediapipe/` | ~2 hours + asset download | C-01 / F-04 / DP-04 (highest single-item risk) |
| 3 | Issue + verify proof-of-play tokens on `/api/score` | ~3 hours, client + server | A-01 (leaderboard integrity) |
| 4 | Add `isSameOrigin` to `/api/auth/signup` POST | ~5 minutes | A-08 |
| 5 | Apply `referrerPolicy="no-referrer"` to all avatar `<img>` + validate avatar URL on write | ~15 minutes | AU-07 / F-05 |
| 6 | DELETE account: invalidate JWT cookie + reserve username | ~1 hour + DB migration | C-11 + C-13 |
| 7 | Pin `next-auth` exact version (drop caret) | 1 minute | AU-03 / DP-03 |
| 8 | Replace `Math.random()` with `crypto.randomUUID()` in username generation | ~10 minutes | C-02 |
| 9 | Add `Vercel BotID` to signup + login forms | ~1 hour | AU-02 |
| 10 | Plan Next.js 15 → 16 upgrade (separate PR using `vercel:next-upgrade`) | half-day | DP-02 |

## Findings index

| Tag | Title | Severity | Report |
|---|---|---|---|
| C-01 | MediaPipe WASM loaded from CDN without SRI | High | reports/code-security-analysis.md |
| C-02 | Math.random() in username generation | Low | reports/code-security-analysis.md |
| C-03 | JSON-in-Redis member validation on read | Info | reports/code-security-analysis.md |
| C-04 | JWT background DB sync amplifies DB load | Medium | reports/code-security-analysis.md |
| C-05 | Score ID mismatch between Redis and DB | Info | reports/code-security-analysis.md |
| C-06 | SSE setInterval poll loop per connection | Low | reports/code-security-analysis.md |
| C-07 | `VERCEL === '1'` is the only fail-closed signal | Low | reports/code-security-analysis.md |
| C-08 | `x-forwarded-for` parsed verbatim | Low | reports/code-security-analysis.md |
| C-09 | Dead code in csrf.ts | Info | reports/code-security-analysis.md |
| C-10 | CSRF check passes when Origin+Referer absent | Medium | reports/code-security-analysis.md |
| C-11 | DELETE account doesn't invalidate JWT | Medium | reports/code-security-analysis.md |
| C-12 | Race in signup uniqueness | Low | reports/code-security-analysis.md |
| C-13 | Account-recycle impersonation | Medium | reports/code-security-analysis.md |
| C-14 | History cursor not validated | Low | reports/code-security-analysis.md |
| C-15 | Math.random() for game timer (informational) | Info | reports/code-security-analysis.md |
| C-16 | console.error production logging | Info | reports/code-security-analysis.md |
| C-17 | Password 8-char minimum, no breach check | Low | reports/code-security-analysis.md |
| AU-01 | No email verification on signup | Medium | reports/auth-security.md |
| AU-02 | No CAPTCHA / bot challenge on signup or login | Medium | reports/auth-security.md |
| AU-03 | next-auth in beta | Medium | reports/auth-security.md |
| AU-04 | (= C-11) | Medium | reports/auth-security.md |
| AU-05 | (= C-04) | Medium | reports/auth-security.md |
| AU-06 | (= C-17) | Low | reports/auth-security.md |
| AU-07 | Google avatar URL rendered raw | Low | reports/auth-security.md |
| AU-08 | No custom Auth.js error/verifyRequest pages | Low | reports/auth-security.md |
| AU-09 | `trustHost: true` | Info | reports/auth-security.md |
| AU-10 | Username regex inconsistency | Low | reports/auth-security.md |
| AU-11 | No MFA / 2FA | Low | reports/auth-security.md |
| AU-12 | Generic login error message | Pass | reports/auth-security.md |
| AU-13 | bcrypt cost 12 | Pass | reports/auth-security.md |
| AU-14 | Owner-only check on /api/profile/settings | Pass | reports/auth-security.md |
| AU-15 | Server-side ownership lookup on /profile/me | Pass | reports/auth-security.md |
| A-01 | Anonymous score with no proof-of-play | Medium-High | reports/api-security.md |
| A-02 | /api/leaderboard no rate limit | Low | reports/api-security.md |
| A-03 | SSE fail-open + connection cap | Low | reports/api-security.md |
| A-04 | /api/profile/[username]/history unauthenticated | Low | reports/api-security.md |
| A-05 | x-vercel-ip-country trust | Info | reports/api-security.md |
| A-06 | Profile PATCH validation | Pass | reports/api-security.md |
| A-07 | Per-submission Redis op count | Info | reports/api-security.md |
| A-08 | No CSRF on /api/auth/signup | Medium | reports/api-security.md |
| A-09 | /api/profile/me strict ownership | Pass | reports/api-security.md |
| A-10 | Public profile read | Info | reports/api-security.md |
| A-11 | Authenticated submission re-resolves username | Pass | reports/api-security.md |
| A-12 | Settings field handling | Info | reports/api-security.md |
| F-01 | No CSP | High | reports/frontend-security.md |
| F-02 | No clickjacking protection | High | reports/frontend-security.md |
| F-03 | No HSTS in-app | Medium | reports/frontend-security.md |
| F-04 | (= C-01) | High | reports/frontend-security.md |
| F-05 | (= AU-07) | Low | reports/frontend-security.md |
| F-06 | Browser storage XSS poisoning | Info | reports/frontend-security.md |
| F-07 | No DOM-based XSS sinks | Pass | reports/frontend-security.md |
| F-08 | External link hygiene | Pass | reports/frontend-security.md |
| F-09 | No client-side secrets | Pass | reports/frontend-security.md |
| F-10 | Production sourcemaps | Info | reports/frontend-security.md |
| F-11 | No Permissions-Policy | Medium | reports/frontend-security.md |
| D-01 | SQL injection — parameterized | Pass | reports/database-security.md |
| D-02 | Redis injection — JSON-encoded | Pass | reports/database-security.md |
| D-03 | bcrypt cost 12 | Pass | reports/database-security.md |
| D-04 | Encryption at rest (provider) | Info | reports/database-security.md |
| D-05 | (= C-13) | Medium | reports/database-security.md |
| D-06 | Long-lived all-time leaderboards | Info | reports/database-security.md |
| D-07 | Drizzle prepared-statement reuse | Pass | reports/database-security.md |
| D-08 | Username cooldown enforcement | Pass | reports/database-security.md |
| D-09 | Snapshot rewriter best-effort | Low | reports/database-security.md |
| D-10 | No multi-tenant model | Pass | reports/database-security.md |
| I-01 | Missing platform headers | High (= F-01..F-03) | reports/infrastructure-security.md |
| I-02 | vercel.json minimal | Info | reports/infrastructure-security.md |
| I-03 | Environment variables | Pass | reports/infrastructure-security.md |
| I-04 | AUTH_SECRET presence unverified | Info | reports/infrastructure-security.md |
| I-05 | .env.local gitignored | Pass | reports/infrastructure-security.md |
| I-06 | Vercel WAF status visibility | Medium | reports/infrastructure-security.md |
| I-07 | No pre-commit secret scan | Info | reports/infrastructure-security.md |
| I-08 | No cron jobs | Info | reports/infrastructure-security.md |
| I-09 | vercel.json vs vercel.ts | Info | reports/infrastructure-security.md |
| DP-01 | drizzle-kit → esbuild advisory | Low (dev-only) | reports/dependency-security.md |
| DP-02 | Next.js major version lag | Medium | reports/dependency-security.md |
| DP-03 | next-auth caret on beta | Medium (= AU-03) | reports/dependency-security.md |
| DP-04 | MediaPipe CDN no SRI | High (= C-01) | reports/dependency-security.md |
| DP-05 | Unused MediaPipe helper packages | Info | reports/dependency-security.md |
| DP-06 | No Node engine pin | Info | reports/dependency-security.md |
| DP-07 | Lockfile integrity | Pass | reports/dependency-security.md |
| DP-08 | No git submodules / private registry | Pass | reports/dependency-security.md |

## Remediation roadmap

### Sprint 1 (this week — security headers + supply chain)

- Apply `next.config.ts` headers (Fix-F-01).
- Self-host MediaPipe (Fix-F-04).
- Apply avatar `referrerPolicy` + URL allowlist (Fix-F-05 / AU-07).
- Add `isSameOrigin` to signup (Fix-A-08).
- Pin `next-auth` exact (Fix-DP-03).
- Pin `engines.node` (Fix-DP-06).
- Remove unused MediaPipe helper packages (Fix-DP-05).
- Verify Vercel WAF + `AUTH_SECRET` (I-04, I-06).

**Owner verification checklist after Sprint 1**:
- `curl -I https://dabpose.fun/` shows: CSP, X-Frame-Options, HSTS, Permissions-Policy, Referrer-Policy, X-Content-Type-Options.
- DevTools Console clean on a full game round.
- MediaPipe `Network` panel shows requests to `/mediapipe/...` (same-origin), not jsdelivr.

### Sprint 2 (next week — authn integrity)

- DELETE account: invalidate JWT + soft-delete (Fix-C-11 / C-13). Includes a DB migration.
- JWT tag-based sync (Fix-C-04).
- Replace `Math.random()` with CSPRNG (Fix-C-02).
- Add Vercel BotID to signup + login (Fix-AU-02).
- Tighten `isSameOrigin` for authenticated callers (Fix-C-10).
- 409 on signup race (Fix-C-12).
- Validate history cursor (Fix-C-14).
- Unify username regex (Fix-AU-10).

### Sprint 3 (next 2 weeks — leaderboard integrity)

- Proof-of-play token (Fix-A-01) — new `/api/play/start` + client + server changes.
- Light limiter on public reads (Fix-A-02 / A-04).
- Lower SSE cap + emit error event (Fix-A-03).
- Email verification gate (Fix-AU-01) — requires choosing an email provider.

### Sprint 4+ (deferred, half-day each)

- Next.js 15 → 16 upgrade (Fix-DP-02).
- Migrate platform config to `vercel.ts` (Fix-I-09).
- Move CSRF + rate-limit + headers to Routing Middleware (R-01).
- Adopt `zod` for body validation (R-02).
- Consolidate avatar into `<UserAvatar>` (R-05).

## What was **not** changed by this audit

No file in `/Users/m3kh/Projects/Dab Pose/src` was modified. Every patch is a recommendation in `security-audit/fixes/security-fixes.md`. The owner controls the apply decision.

## Confidence and limitations

- **Confidence: high** on the code-side findings (the entire `src/` was read directly; no excerpting).
- **Confidence: medium** on the platform / WAF claims (the WAF rule set is observable only from Vercel's dashboard; local notes are authoritative for state but should be re-verified).
- **Confidence: low** on production runtime behavior (the audit did not exercise the live site; CSP / HSTS / Permissions-Policy reports rely on the assumption that no header is set in-app and Vercel's defaults are used).

## Contact

This audit is the property of the project owner (เมฆ). Findings should be reviewed by the owner before any are publicly disclosed. The audit was performed within Claude Code locally on 2026-05-18.
