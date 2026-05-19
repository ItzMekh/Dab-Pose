# Latest Security Trends (2025–2026)

Notes drawn from public advisories, OWASP guidance, and vendor knowledge as of 2026-05-18.

## OWASP Top 10 2021 — applicability to Dab Pose

| Item | Applies | Where in Dab Pose |
|---|---|---|
| A01 — Broken Access Control | Yes | C-10, C-11, C-13 |
| A02 — Cryptographic Failures | Partial | C-02 (weak randomness for usernames) |
| A03 — Injection | No (parameterized ORM, JSON-only Redis members) | D-01, D-02 pass |
| A04 — Insecure Design | Yes | A-01 (no proof-of-play), C-04, C-13 |
| A05 — Security Misconfiguration | **Yes — most findings here** | F-01, F-02, F-03, F-11, I-01 |
| A06 — Vulnerable/Outdated Components | Yes | DP-01..DP-05, C-01 |
| A07 — Identification/Auth Failures | Yes | AU-01..AU-03, AU-11, C-11 |
| A08 — Software/Data Integrity Failures | Yes | C-01, C-03, F-04 |
| A09 — Security Logging/Monitoring Failures | Partial | C-16 (`console.error` only) |
| A10 — SSRF | No | no user-supplied URLs are fetched server-side |

OWASP Top 10 2026 (draft community discussion) splits A05 and emphasises supply-chain risk — the project's MediaPipe CDN load (F-04) is squarely in that bucket.

## CWE focus areas

- **CWE-352 (CSRF)** — partially covered, see C-10.
- **CWE-613 (Insufficient Session Expiration)** — C-11.
- **CWE-285 (Improper Authorization)** — C-13 (account-recycle).
- **CWE-1021 (Improper Restriction of Rendered UI Layers)** — F-02 (clickjacking).
- **CWE-338 (Cryptographically Weak PRNG)** — C-02.
- **CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)** — C-01 (MediaPipe).

## Framework advisories worth monitoring

### Next.js (project on 15.5.18; latest 16.2.6)
- Multiple SSRF/header-handling fixes landed in 15.x and 16.x throughout 2025; the team should review changelogs for the 15.x line for every backported security advisory.
- Server Actions security model tightened — not used in this project.
- The new "Routing Middleware" (framework-agnostic Vercel product) replaces some Next-specific middleware patterns; consider migrating CSRF + rate-limit gates from in-route to platform middleware for a single chokepoint.

### Auth.js v5 (beta)
- Several v5 betas have had cookie-handling regressions during the year. Track Auth.js v5 GA notes.
- v5 PKCE handling on Google has shifted between betas (per the project's own `auth_errors_reference.md`).

### Drizzle ORM / drizzle-kit
- The `@esbuild-kit/*` dependency has an open advisory (GHSA-67mh-4wv8-2f99). Upstream drizzle-kit is moving to `tsx`-based loaders — track the issue.

### Upstash Redis client
- The library's command surface has been stable. No recent CVEs against `@upstash/redis@1.x`.

### bcryptjs
- bcryptjs is pure-JS and slower than native bcrypt; for the project's scale this is fine. No CVEs in the 3.x line.

## Vercel platform context

The Vercel knowledge update bundled in this session (2026-02-27) confirms:
- Default function timeout is now 300 s on all plans.
- Vercel BotID is GA since June 2025 — recommended for signup/login (AU-02).
- Vercel Queues (public beta) — could replace the SSE polling loop in C-06.
- Vercel WAF custom rules — Hobby plan cap 3 rules, which the project hits today. Pro plan removes the cap.
- Routing Middleware supports Node.js + Bun + Edge runtimes; appropriate for moving rate-limit + CSRF + header injection to a single platform layer.

## Emerging attack patterns relevant to this project

### 1. Supply chain compromises of CDN-loaded ML models
2024–2025 saw multiple cases of compromised JS bundles served from CDNs that bundle ML libraries (ONNX runtime, transformers.js, ...). MediaPipe is a high-profile target. The lack of SRI on F-04 is the single most impactful finding in this audit.

### 2. WAF evasion via IP rotation
Anonymous score-spam (A-01) defeats per-IP rate limits with a rotating residential-proxy pool. The proof-of-play token approach blocks this without needing more rules.

### 3. Account-recycle for reputation transfer
The pattern in C-13 (deleted username can be re-claimed, public leaderboard rows still link to the new account) appeared in several gaming-leaderboard incidents in 2025. Soft-delete or username reservation is the standard fix.

### 4. JWT background sync amplification
Discussed in C-04. As Auth.js v5 popularizes the pattern of "callback-side DB sync", load amplification has been observed in larger deployments. Tag-based invalidation via Redis is the migration path.

### 5. SSE / WebSocket polling cost amplification
C-06. Multiple smaller SaaS apps in 2025 were billed surprise five-figure CDN/cache costs when SSE handlers held open Redis polls during a botnet incident.

## What to monitor

- GitHub Security Advisories for `vercel/next.js`, `nextauthjs/next-auth`, `drizzle-team/drizzle-orm`, `upstash/redis`.
- jsdelivr CDN incident history (rare but possible).
- NVD CVE feed filtered to the project's direct dependencies (15 packages).
- Vercel security blog and the Vercel Agent (AI code review) feature for ongoing reviews.

## Confidence

Findings in this audit are grounded in:
- direct source-file reads (every file in `src/` and the project root config),
- npm audit + outdated raw outputs in `artifacts/`,
- the project's own `SECURITY_FIXES.md` and `MEMORY.md` reference history,
- public OWASP / CWE / framework documentation.

No live exploitation was performed. Findings tagged as "Pass" are derived from absence of patterns in the source code — they are not absolute guarantees; subsequent code changes can re-introduce them.
