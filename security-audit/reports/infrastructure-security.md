# Infrastructure & DevOps Security

Tag prefix `I-NN`.

## Summary

| Finding | Severity |
|---|---|
| I-01 No security response headers set in `next.config.ts` / `vercel.json` | **High** (= F-01..F-03) |
| I-02 `vercel.json` minimal — no `crons`, no `headers`, no `rewrites`, no `redirects` | Info |
| I-03 Environment variables: only 3 server-side (good) — `DATABASE_URL`, `UPSTASH_REDIS_REST_*` | Pass |
| I-04 `AUTH_SECRET` presence cannot be verified from source — must be set in Vercel project env | Info |
| I-05 `.env.local` exists locally (gitignored) — confirm not in deployment | Pass |
| I-06 Vercel WAF: 3 rules on Hobby plan, all `action=log` mode per local notes | Medium |
| I-07 No deploy-time secret scanning | Info |
| I-08 Cron jobs absent — no scheduled cleanup of long-lived Redis data | Info |
| I-09 No `vercel.ts` (the modern TS config), `vercel.json` is used instead | Info |

---

## I-01 — Missing platform security headers

Cross-reference F-01, F-02, F-03, F-11. The fix block in `frontend-security.md` is the consolidated patch.

---

## I-02 — `vercel.json` is minimal

```json
{
  "alias": ["dab-pose.vercel.app", "dabpose.fun", "www.dabpose.fun"]
}
```

That is the entire file. No headers, no redirects, no rewrites, no cron, no function config. All cron/headers gates have to be done in `next.config.ts` headers or in code.

### Recommended fix
Migrate to `vercel.ts` per current Vercel recommendation and centralize headers + crons + rewrites there. See `docs/dependency-map.md` for the Vercel platform note (`vercel.ts` is now the recommended config file).

### References
- Vercel knowledge update — `vercel.ts` replaces `vercel.json`

---

## I-03 — Environment variables surface — PASS

Only three server-side env vars are referenced:
- `DATABASE_URL` (Neon)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Plus Auth.js's internal `AUTH_SECRET` (read by next-auth itself).

No `NEXT_PUBLIC_*` exposed. **Pass.**

---

## I-04 — `AUTH_SECRET` presence

### Severity
**Info**

### Description
`AUTH_SECRET` is required by Auth.js v5 for JWT signing. Cannot be observed in `src/` because the framework reads it directly. **Action item for the owner**: confirm `AUTH_SECRET` is set in Vercel's Production env, is at least 32 random bytes, and is not committed.

```bash
vercel env ls production | grep AUTH_SECRET
```

If absent, run `openssl rand -base64 32 | vercel env add AUTH_SECRET production`.

---

## I-05 — `.env.local` locally — PASS

`.env.local` is in `.gitignore`. Vercel does not read this file at deploy time (only at local `vercel dev`). **Pass.**

---

## I-06 — Vercel WAF state

### Severity
**Medium** (visibility / verification)

### Description
Per local notes (`MEMORY.md` and `SECURITY_FIXES.md`), the Hobby plan's 3-rule cap is fully used:
1. Rate-limit POST `/api/score` (30/60s/IP) — likely enforce by now per `waf_review_2026-05-18` memory.
2. Block exploit probes (`/wp-admin`, `/.env`, etc.) — Deny per memory.
3. Log signup POSTs.

The rules cannot be re-verified from local source. **Action item for the owner**: re-run `vercel firewall rules ls` and confirm:
- All three rules are present.
- Their actions match the intended mode (enforce, deny, log).
- The rate-limit rule covers the actual endpoint path (`/api/score` exact match, not a regex that misses).

If the project upgrades from Hobby → Pro, plan additional rules:
- `/api/auth/signup` rate-limit (defense-in-depth alongside the in-app limiter).
- `/api/auth/callback/credentials` rate-limit (login bcrypt path).
- `/api/leaderboard` light limit.

### References
- Vercel firewall docs

---

## I-07 — Deploy-time secret scanning — INFO

### Description
No `gitleaks` / `trufflehog` / pre-push hook is configured. The repo has never accidentally committed a secret (per local notes), but future-proofing is cheap.

### Recommended fix
Add a `.husky/pre-commit` that runs `gitleaks protect --staged`, or rely on GitHub Push Protection (enabled by default on public repos).

---

## I-08 — No cron jobs

### Severity
**Info**

### Description
No `crons` config in `vercel.json` and no `app/api/cron/*` routes. Recommended additions for long-term hygiene:
- **Stale-snapshot sweeper** (D-09).
- **Top-N trim** of `lb:single:all` and `lb:streak:all` (D-06).
- **Account-deletion tombstone GC** (after username reservation feature).

---

## I-09 — Modern `vercel.ts` not adopted

### Description
Vercel recommends `vercel.ts` (with `@vercel/config`) for full TypeScript config including dynamic logic, headers, crons, and rewrites. Migrating consolidates all platform config in one place.

### Recommended fix
```ts
// vercel.ts
import { type VercelConfig } from '@vercel/config/v1'

const csp = [/* see frontend-security.md F-01 */].join('; ')

export const config: VercelConfig = {
  framework: 'nextjs',
  headers: [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
  crons: [
    { path: '/api/cron/leaderboard-trim', schedule: '0 4 * * *' },
  ],
}
```

---

## Infrastructure hardening checklist

- [ ] Migrate to `vercel.ts` and define security headers there (I-01, I-09)
- [ ] Re-verify Vercel WAF rule state via CLI (I-06)
- [ ] Confirm `AUTH_SECRET` is set in production env (I-04)
- [ ] Add gitleaks pre-commit (I-07)
- [ ] Add cron-based leaderboard maintenance (I-08, D-06)
