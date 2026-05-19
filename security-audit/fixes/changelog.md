# Changelog — Audit Deliverables

## 2026-05-18 — Initial audit

**Scope**: full source-code review of `/Users/m3kh/Projects/Dab Pose` plus dependency tree.

### Deliverables produced
- `security-audit/docs/`
  - project-overview.md
  - architecture.md
  - dependency-map.md
  - security-scope.md
- `security-audit/reports/`
  - code-security-analysis.md (17 findings, C-01 … C-17)
  - auth-security.md (15 findings, AU-01 … AU-15)
  - api-security.md (12 findings, A-01 … A-12)
  - frontend-security.md (11 findings, F-01 … F-11)
  - database-security.md (10 findings, D-01 … D-10)
  - infrastructure-security.md (9 findings, I-01 … I-09)
  - dependency-security.md (8 findings, DP-01 … DP-08)
- `security-audit/research/`
  - latest-security-trends.md
  - emerging-vulnerabilities.md
  - framework-security-alerts.md
- `security-audit/fixes/`
  - security-fixes.md (priority-ordered patch list)
  - refactor-summary.md (R-01 … R-07)
  - changelog.md (this file)
- `security-audit/artifacts/`
  - npm-audit.json (raw)
  - npm-outdated.json (raw)
- `security-audit/html-report/`
  - index.html, styles.css, app.js (interactive dashboard)
- `security-audit/master-report.md` (executive summary)
- `security-audit/logs/execution-log.md`

### Files modified in source tree (round 1 — audit only)
**None.** All audit-phase recommendations live in `fixes/security-fixes.md`.

### Files modified in source tree (round 2 — CF proxy implementation)
After the audit, the owner approved implementing the CF-proxy track for AU-02. Source changes applied:

- `src/lib/client-meta.ts` (new) — Cloudflare-aware `clientCountry()` / `clientCountryFromHeaders()` helpers.
- `src/lib/ratelimit.ts` — `clientIp()` reads `CF-Connecting-IP` first.
- `src/auth.ts` — `detectCountry()` uses the new helper.
- `src/app/api/score/route.ts` — country resolution uses the new helper.
- `src/app/api/country/detect/route.ts` — uses the new helper.

See `fixes/cf-proxy-implementation-summary.md` for the full session report and `fixes/cloudflare-migration.md` for the dashboard / DNS runbook.

### Backup
Originals saved under `backup/` before edit:
- `auth.ts.bak`
- `ratelimit.ts.bak`
- `score.route.ts.bak`
- `country-detect.route.ts.bak`

### Owner action items (in apply order)
1. Review `security-audit/master-report.md`.
2. Confirm `AUTH_SECRET`, `DATABASE_URL`, `UPSTASH_REDIS_REST_*` in Vercel env (I-04).
3. Re-verify Vercel WAF rules (I-06) via `vercel firewall rules ls`.
4. Apply Priority 1 fixes from `fixes/security-fixes.md` (headers, MediaPipe self-host, avatar referrerPolicy, signup CSRF, DELETE invalidation).
5. Apply Priority 2 fixes (proof-of-play token, BotID, JWT tag-based sync, Next.js 15 → 16 plan).
6. Schedule Priority 3 hygiene fixes.
