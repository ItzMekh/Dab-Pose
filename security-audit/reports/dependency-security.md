# Dependency Security

Tag prefix `DP-NN`.

## Summary

| Finding | Severity |
|---|---|
| DP-01 4 moderate npm audit findings — all `drizzle-kit` → `esbuild` transitive | Low (dev-only) |
| DP-02 Next.js 15.5.18 — one major behind (16.x available) | Medium |
| DP-03 `next-auth ^5.0.0-beta.31` — caret on pre-release | Medium (= AU-03) |
| DP-04 MediaPipe via jsdelivr CDN with no SRI | High (= C-01) |
| DP-05 Unused MediaPipe helper packages (`camera_utils`, `drawing_utils`) | Info |
| DP-06 No `package.json` `engines` pin for Node version | Info |
| DP-07 No `npm-shrinkwrap`, lockfile is `package-lock.json` v3 | Pass |
| DP-08 No git submodules; no private registry | Pass |

---

## DP-01 — `drizzle-kit` → `esbuild` advisory chain

### Severity
**Low** (dev-only blast radius)

### Affected packages
```
drizzle-kit@^0.31.10
  └─ @esbuild-kit/esm-loader
       └─ @esbuild-kit/core-utils
            └─ esbuild <=0.24.2  ← GHSA-67mh-4wv8-2f99
```

### Advisory
> esbuild enables any website to send any requests to the development server and read the response.
> https://github.com/advisories/GHSA-67mh-4wv8-2f99
> CVSS 5.3 (medium), CWE-346
> Impact: only when a developer runs the esbuild dev server on a port the network can reach. drizzle-kit invokes esbuild during migrations only — no persistent dev server. **Effective impact: very low.**

### Recommended fix
`npm audit fix` would downgrade drizzle-kit to 0.18 — undesirable.

Wait for a drizzle-kit release that drops `@esbuild-kit/*` (the maintainer has signalled this is upcoming). Track the issue.

In the meantime, mitigate by:
- Never run `drizzle-kit studio` (`drizzle-kit dev`) on a network-reachable port.
- Document in `CLAUDE.md` that drizzle-kit dev tooling is local-only.

---

## DP-02 — Next.js 15.5.18 — major version lag

### Severity
**Medium**

### Description
Currently `next@15.5.18`. Latest `next@16.2.6`. Two minor lines exist:
- 15.x: maintained for security backports.
- 16.x: current line.

Next.js has a history of disclosures in 15.x (image optimization SSRF, server actions path-traversal, etc.). Most have been backported, but each release of 16.x widens the "fixed-in-16-only" surface.

### Recommended fix
Plan an upgrade following the official guide. The `vercel:next-upgrade` skill is suited to this.

### References
- Next.js release notes
- GitHub Security Advisories for `vercel/next.js`

---

## DP-03 — `next-auth ^5.0.0-beta.31`

See **AU-03**. Pin exact: `"next-auth": "5.0.0-beta.31"` (drop the caret).

---

## DP-04 — MediaPipe via jsdelivr CDN

See **C-01** / **F-04**. The Holistic WASM bundle is fetched at runtime from jsdelivr with no SRI. **Highest-priority dependency hardening item.**

---

## DP-05 — Unused MediaPipe helper packages

### Severity
**Info**

### Affected
- `@mediapipe/camera_utils` ^0.3.*
- `@mediapipe/drawing_utils` ^0.3.*

### Description
The project's `CameraFeed.tsx` implements its own `requestAnimationFrame` loop and manual landmark drawing on the canvas. It does not import the helper packages. They are declared as direct dependencies but unused at runtime.

A grep confirms:
```
$ grep -rn '@mediapipe/camera_utils\|@mediapipe/drawing_utils' src/
(no matches)
```

### Recommended fix
Remove from `package.json` to shrink the install graph and lockfile attack surface.

```bash
npm uninstall @mediapipe/camera_utils @mediapipe/drawing_utils
```

---

## DP-06 — No Node version pin

### Severity
**Info**

### Description
`package.json` does not set `engines.node`. Vercel runs the current Node default (24 LTS as of 2026), which is fine.

### Recommended fix
Pin to be explicit:

```json
"engines": {
  "node": ">=20.0.0 <26.0.0"
}
```

---

## DP-07 — Lockfile integrity — PASS

`package-lock.json` is v3, checked in, single source of truth. No `yarn.lock`, no `pnpm-lock.yaml`. **Pass.**

---

## DP-08 — No git submodules / private registry — PASS

The repo references only `https://registry.npmjs.org/` (default). No `npmrc` overrides the registry. **Pass.**

---

## Hardening checklist

- [ ] Pin `next-auth` to exact version (DP-03 / AU-03)
- [ ] Plan Next.js 15 → 16 upgrade (DP-02)
- [ ] Self-host MediaPipe WASM or add SRI (DP-04)
- [ ] Remove unused `@mediapipe/camera_utils` and `@mediapipe/drawing_utils` (DP-05)
- [ ] Pin `engines.node` (DP-06)
- [ ] Monitor drizzle-kit upstream for esbuild-kit drop (DP-01)
