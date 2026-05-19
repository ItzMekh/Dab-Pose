# Framework Security Alerts (Tracking List)

Subscribe to these sources for the project's direct dependencies. The project currently does **not** have an automated alert pipeline.

## Direct subscriptions to set up

| Source | URL | Why |
|---|---|---|
| GitHub Security Advisories (vercel/next.js) | github.com/vercel/next.js/security/advisories | Project on 15.5.18 — actively backported |
| GitHub Security Advisories (nextauthjs/next-auth) | github.com/nextauthjs/next-auth/security/advisories | v5 beta — fast-moving |
| GitHub Security Advisories (drizzle-team/drizzle-orm) | github.com/drizzle-team/drizzle-orm/security | ORM core |
| GitHub Security Advisories (drizzle-team/drizzle-kit-mirror) | github.com/drizzle-team/drizzle-kit-mirror/security | currently has open esbuild advisory |
| GitHub Security Advisories (upstash/upstash-redis) | github.com/upstash/upstash-redis/security | Redis client |
| GitHub Security Advisories (kelektiv/node.bcrypt.js) | github.com/kelektiv/node.bcrypt.js | (bcryptjs fork tree) |
| GitHub Security Advisories (google/mediapipe) | github.com/google-ai-edge/mediapipe | WASM ML core |
| Vercel security blog | vercel.com/security | platform-side issues |
| NIST NVD CVE feed (filtered) | nvd.nist.gov | last-resort fallback |
| Snyk Vulnerability DB | snyk.io/vuln | mirror, often earlier than NVD |
| HIBP Pwned Passwords | haveibeenpwned.com | for AU-02 / C-17 (breach-list check on signup) |

## Recommended automation

1. **Dependabot security updates** — enable on the GitHub repo. Bumps are PRs; review before merge.
2. **GitHub Push Protection** — enable; catches secrets pushed by humans or by automation.
3. **Renovate** (alternative to Dependabot) — supports grouping, schedules, lockfile maintenance.
4. **`npm audit` on CI** — fail the build on `high` or `critical`. Today `moderate` is acceptable since the only ones are dev-only.

## Today's status (2026-05-18)

```
direct dependencies:    15 (prod) + 12 (dev)
audit findings:         4 moderate (drizzle-kit → esbuild)
critical / high:        0
outdated (major lag):   8 (most dev-only; next + framer-motion + lucide-react in prod)
```

The project is healthy. The single high-priority dependency item is the MediaPipe CDN trust (F-04 / C-01), which is **not** a CVE — it is an architecture choice that needs hardening.
