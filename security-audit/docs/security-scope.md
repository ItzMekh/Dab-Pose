# Security Scope

## In scope

- All source files under `src/`, configuration files (`next.config.ts`, `vercel.json`, `eslint.config.mjs`, `drizzle.config.ts`, `playwright.config.ts`), and `package.json` lock state of `/Users/m3kh/Projects/Dab Pose` as of 2026-05-18.
- The 11 production API routes under `src/app/api/**`.
- The Auth.js v5 (next-auth ^5.0.0-beta.31) configuration and JWT lifecycle.
- Postgres (Drizzle) and Redis (Upstash) data flows initiated from app code.
- Frontend XSS / clickjacking / CSP surface for the page components.
- Dependency tree (direct + transitive, prod + dev) as of `npm install` against the committed lockfile.

## Out of scope

- The deployed Vercel infrastructure, runtime, and platform-supplied headers beyond what code controls.
- Neon and Upstash provider security.
- Google OAuth platform security.
- Browser security model (CORS / Permissions API / MediaStream).
- Real-world penetration testing of `dabpose.fun` (allowed only as authorized smoke tests within rate-limit; aggressive testing must not be performed).
- The `/agent` Claude SDK sub-project (gitignored, not deployed).
- `scripts/*` operational scripts (gitignored, local-only tooling).
- Test files (`tests/*`, gitignored).
- The Vercel WAF rule contents — read-only from local notes; the live rule set is to be re-verified by the owner.

## Methodology

1. Read every file under `src/` (full content) and every config at the repo root.
2. Map data flows for every authenticated and unauthenticated path.
3. Static grep for code-injection sinks, DOM sinks, browser-storage sinks, env reads, JSON.parse, and weak randomness.
4. Run `npm audit --json` and `npm outdated --json` against the committed lockfile.
5. Cross-reference findings with OWASP Top 10 2021 + ASVS L1.
6. Triage by severity using CVSS 3.1 base scoring intuition:
   - **Critical** = remote code execution / mass data exfiltration / auth bypass with no prerequisites.
   - **High** = privilege escalation, persistent XSS, auth bypass with limited prerequisites, supply chain RCE.
   - **Medium** = abuse vectors that require interaction, weakened cryptography, configuration drift, scoring/integrity bypass.
   - **Low** = informational, hardening, defense-in-depth.

## Authorization statement

This audit is performed on a project owned by the requester (เมฆ / m3kh) under explicit authorization. No third-party assets are tested. No destructive actions are taken. Source files are read; no live exploitation against `dabpose.fun` is conducted. All proposed code changes are written to `/security-audit/fixes/` as recommendations, not applied to source.

## Reporting structure

```
security-audit/
  docs/         — project overview, architecture, dep map, scope (this file)
  reports/      — per-domain findings (code, auth, api, frontend, db, infra, dep)
  research/     — emerging vuln research notes
  fixes/        — proposed remediation patches and refactor notes
  logs/         — execution log
  html-report/  — interactive dashboard (index.html + styles.css + app.js)
  artifacts/    — npm audit raw, outdated raw, build outputs (if any)
  backup/       — copies of any file before a proposed fix
```

The `master-report.md` at the repo root of `/security-audit` is the single entry point for human readers; the HTML dashboard is the interactive view of the same findings.
