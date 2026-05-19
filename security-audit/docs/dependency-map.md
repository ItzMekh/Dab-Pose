# Dependency Map

## 1. Direct production dependencies (15)

| Package | Version | Use | Risk surface |
|---|---|---|---|
| `next` | ^15.3.9 (resolved 15.5.18) | Framework | App Router, Server Components, middleware/proxy |
| `react` | ^19.0.0 | UI | Render layer |
| `react-dom` | ^19.0.0 | UI | DOM bridge |
| `next-auth` | ^5.0.0-**beta.31** | Auth | OAuth + Credentials + JWT — **pre-release, breaking-change risk** |
| `@neondatabase/serverless` | ^1.1.0 | Postgres driver | HTTPS to Neon |
| `drizzle-orm` | ^0.45.2 | ORM | Query construction |
| `@upstash/redis` | ^1.38.0 | Redis REST client | Score writes, leaderboard reads |
| `@upstash/ratelimit` | ^2.0.8 | Sliding window | signup/settings/password/events |
| `bcryptjs` | ^3.0.3 | Password hashing | cost 12, pure JS (no native binding) |
| `@mediapipe/holistic` | ^0.5.1675471629 | Pose detection | WASM, **CDN-loaded with no SRI** |
| `@mediapipe/camera_utils` | ^0.3.* | Pose helper | unused at runtime (loop is custom) |
| `@mediapipe/drawing_utils` | ^0.3.* | Pose helper | unused at runtime |
| `framer-motion` | ^11.18.2 | Animations | Client-only, no remote calls |
| `lucide-react` | ^0.511.0 | Icons | SVG bundles only |
| `class-variance-authority` / `clsx` / `tailwind-merge` | — | Class composition | Local |
| `@vercel/analytics` | ^2.0.1 | Analytics | Vercel-managed |
| `@vercel/speed-insights` | ^2.0.0 | RUM | Vercel-managed |

## 2. Direct dev dependencies (12)

| Package | Version | Use |
|---|---|---|
| `typescript` | ^5 (5.9.3) | Type checker |
| `eslint` | ^9 (9.39.4) | Linter |
| `eslint-config-next` | 15.3.2 | Plugin set |
| `@eslint/eslintrc` | ^3.3.5 | Compat layer |
| `@playwright/test` | ^1.52.0 | E2E test |
| `drizzle-kit` | ^0.31.10 | Migrations |
| `dotenv` | ^17.4.2 | Env loader (test scripts) |
| `tailwindcss` | ^4 + `@tailwindcss/postcss` | Styles |
| `@types/*` | — | Type defs |

## 3. Outdated direct deps (semver-major lag)

| Package | Installed | Latest | Risk |
|---|---|---|---|
| `next` | 15.5.18 | **16.2.6** | One major behind. Next.js 16 fixed several SSRF/path-traversal advisories in 15.x. **Action: review Next.js 15.x security advisories and decide whether to upgrade.** |
| `next-auth` | 5.0.0-beta.31 | (latest stable: 4.24.14, pre-release: 5.x betas) | Beta. APIs may shift. **Action: track v5 GA timeline; pin exact version.** |
| `framer-motion` | 11.18.2 | 12.38.0 | Major bump available, no known CVEs. |
| `lucide-react` | 0.511.0 | 1.16.0 | Major bump, no known CVEs. |
| `eslint` | 9.39.4 | 10.4.0 | Dev only. |
| `eslint-config-next` | 15.3.2 | 16.2.6 | Dev only. |
| `typescript` | 5.9.3 | 6.0.3 | Dev only. |
| `@types/node` | 20.19.41 | 25.8.0 | Dev only. |

## 4. npm audit summary (2026-05-18)

```
moderate: 4
high:     0
critical: 0
```

All four are the same chain:

```
drizzle-kit@^0.31.10
  └─ @esbuild-kit/esm-loader
       └─ @esbuild-kit/core-utils
            └─ esbuild (<= 0.24.2)  ← GHSA-67mh-4wv8-2f99
```

**Advisory**: `esbuild` ≤ 0.24.2 enables any website to send arbitrary requests to the running esbuild dev server and read the response (CVE pattern CWE-346, CVSS 5.3). drizzle-kit only invokes esbuild during migrations; it does not run a persistent dev server in this project. **Effective impact: very low**, but a clean upgrade path exists: `drizzle-kit` newer line drops `@esbuild-kit/*`.

`npm audit fix` would downgrade `drizzle-kit` to `0.18.1` (semver-major **down**) which is not desirable. Wait for an upstream drizzle-kit ≥ 0.32 that replaces esbuild-kit, or move to `tsx`-based loaders.

## 5. Indirect dependency totals

```
prod:       46
dev:       431
optional:  157
total:     512
```

No package-lock anomalies observed. `package-lock.json` is checked in. No `git submodule`. No private registries.

## 6. Supply-chain trust assumptions

- **npmjs.com** — primary registry, trusted.
- **jsdelivr CDN** — MediaPipe WASM bundle loaded at runtime via `holistic.locateFile`. The version is pinned but **no Subresource Integrity hash is enforced**. A successful compromise of jsdelivr or the pinned artifact would execute attacker JS in the browser context with camera + DOM + storage access. See **`reports/frontend-security.md`** F-04.
- **Google OAuth + Google avatar URLs** — trusted by spec; avatars are rendered raw with `referrerPolicy="no-referrer"` only on `UserCell.tsx`.

## 7. Internal sub-package

`/agent` has its own `package.json` (a separate Claude Agent SDK runtime). It is **gitignored** (`.gitignore` line 75) and not deployed. Not part of the production attack surface but its `node_modules` exist on disk; out of audit scope.

## 8. Recommended dependency actions

| # | Action | Priority |
|---|---|---|
| 1 | Plan upgrade `next` 15.5.x → 16.2.x using `vercel:next-upgrade` workflow | High |
| 2 | Pin `next-auth` to exact beta or migrate to stable when GA | Medium |
| 3 | Track drizzle-kit upstream for esbuild-kit drop, then upgrade | Low |
| 4 | Optionally remove unused `@mediapipe/camera_utils` and `@mediapipe/drawing_utils` (the project's CameraFeed.tsx draws landmarks manually and runs the loop manually) | Low |
| 5 | Add SRI to MediaPipe CDN load (or self-host the WASM bundle) | **High** — see F-04 |
