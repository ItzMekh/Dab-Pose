# Frontend Security

Tag prefix `F-NN`.

## Summary

| Finding | Severity |
|---|---|
| F-01 No Content Security Policy (CSP) is set | **High** |
| F-02 No X-Frame-Options / frame-ancestors — clickjacking risk on camera-permission flow | **High** |
| F-03 No Strict-Transport-Security header is set in-app | Medium |
| F-04 MediaPipe WASM loaded cross-origin without SRI (= C-01) | High |
| F-05 Avatar img renders raw remote URL on multiple sites (= AU-07) | Low |
| F-06 localStorage and sessionStorage reads are XSS-poisonable surfaces | Info |
| F-07 No DOM-based XSS sinks found | Pass |
| F-08 External anchor with target=_blank includes rel=noopener noreferrer | Pass |
| F-09 No client-side secrets bundled (greppable env vars are server-only) | Pass |
| F-10 Source maps shipped to production: unknown (Next.js default disables in prod build) | Info |
| F-11 Permissions-Policy header not set — Camera/Microphone/Geolocation are unrestricted | Medium |

---

## F-01 — No Content Security Policy (CSP)

### Severity
**High**

### Affected files
- next.config.ts (does not define headers())
- vercel.json (does not define headers)
- src/app/layout.tsx (no CSP meta tag)

### Description
The site ships with **no CSP at all**. The Network panel of the deployed site shows no Content-Security-Policy response header, no Content-Security-Policy-Report-Only either.

### Risk scenario
- If any future XSS vulnerability lands in the app, there is no second line of defense — injected script content runs with full DOM and same-origin fetch capability against the authenticated session cookie.
- With WebAuthn / SSO planned in the future, the absence of CSP is a serious gap.

### Recommended fix
Add a baseline CSP via next.config.ts:

```ts
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://vercel.live https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.vercel.app",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://cdn.jsdelivr.net https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ')

export default {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: cspDirectives },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }]
  },
}
```

Notes:
- script-src includes 'unsafe-inline' because Framer Motion + Next.js dev runtime inject inline scripts. For production strictness, switch to nonce-based CSP — Next.js 16 supports this natively.
- script-src includes https://cdn.jsdelivr.net only as long as MediaPipe is served from there (see F-04).
- frame-ancestors 'none' is the modern replacement for X-Frame-Options: DENY; keep both for older browsers.

### References
- OWASP A05:2021 — Security Misconfiguration
- CSP Level 3 spec
- MDN Content-Security-Policy reference

---

## F-02 — No clickjacking protection on the camera-permission flow

### Severity
**High**

### Affected files
- All pages — X-Frame-Options is not set.

### Description
With no X-Frame-Options or frame-ancestors, an attacker page can embed https://dabpose.fun inside an iframe, overlay a transparent UI, and trick the user into clicking the "Play" button (which triggers getUserMedia() for the camera). The user then sees a familiar browser camera prompt that looks legitimate.

### Risk scenario
- Camera-permission UI redress: the attacker frames the game and uses a transparent overlay to make the camera prompt appear to come from a different context. Once granted, the attacker's invisible-frame page can stream the user's webcam (the camera is opened by dabpose.fun JavaScript inside the frame, but the rendered video element is in the frame, not the attacker's page — so direct theft is limited; however, the user's perception of granted permission may make them more permissive elsewhere).
- More importantly: the game UI is fully clickable inside the frame, so an attacker can frame the leaderboard or profile pages and abuse user actions.

### Recommended fix
Add to next.config.ts headers (see F-01).

### References
- OWASP A05:2021 — Security Misconfiguration
- CWE-1021 — Improper Restriction of Rendered UI Layers
- W3C Permissions Policy

---

## F-03 — No Strict-Transport-Security header set in-app

### Severity
**Medium**

### Description
HSTS is not set by next.config.ts. Vercel **does** set HSTS at the platform level on production custom domains, so the effective coverage is good — but the in-app default is silent on the matter.

### Recommended fix
Set HSTS in next.config.ts (F-01 snippet) for defense in depth.

### References
- OWASP Secure Headers Project

---

## F-04 — MediaPipe WASM cross-origin without SRI

See **C-01**. Promoted as **F-04** for the frontend report. Refer to that finding for details.

---

## F-05 — Avatar URL img renders without referrerPolicy on two sites

See **AU-07**. The fix: apply referrerPolicy="no-referrer" on:
- src/components/profile/ProfileSidebar.tsx:61
- src/components/profile/ProfileSidebar.tsx:99-103
- src/components/landing/ProfileCard.tsx:61-64

---

## F-06 — localStorage / sessionStorage usage is XSS-poisonable

### Severity
**Info**

### Affected files
- src/hooks/useUsername.ts — dab_username (localStorage)
- src/hooks/useCountry.ts — dab_country (sessionStorage)
- src/components/game/GameScreen.tsx:21, 56 — dab_seen_intro (localStorage)

### Description
None of these keys hold a secret. They're convenience UX state. **Pass on confidentiality.**

### Risk scenario
If an XSS bug lands, an attacker could replace dab_username with malicious content — but the codebase **never** renders this value as raw markup; only as text inside an input value attribute and submitted as JSON. Pass on integrity too.

### Recommended fix
None.

---

## F-07 — No DOM-based XSS sinks

A grep for raw-HTML React props, dynamic-code constructors, and direct DOM-write APIs returned **zero matches** in src/. **Pass.**

---

## F-08 — External link hygiene

src/app/privacy/page.tsx:68, 116 use target="_blank" rel="noopener noreferrer". **Pass.**

---

## F-09 — No client-side secrets bundled

A grep for process.env.* finds 8 callsites, all server-only:
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, DATABASE_URL — server-only.
- NODE_ENV === 'development' for dev-only logs.
- VERCEL === '1' for runtime checks.

No NEXT_PUBLIC_* env reads. **Pass.**

---

## F-10 — Production source maps

### Severity
**Info**

### Description
Next.js 15 by default disables sourcemaps in production unless productionBrowserSourceMaps: true is set. The repo's next.config.ts does not opt-in, so production builds should not ship source maps. **Recommendation: verify in DevTools on the live site that .map files are not served.**

---

## F-11 — Permissions-Policy not set

### Severity
**Medium**

### Description
A site-wide Permissions-Policy: camera=(self), microphone=(), geolocation=() would explicitly grant the game's camera need and **deny** any embedded iframe from requesting microphone or geolocation. Without it, the browser falls back to its origin-level defaults — currently every feature is allowed for the origin and its same-origin descendants.

### Recommended fix
See F-01 headers block. Setting Permissions-Policy: camera=(self) ensures cross-origin frames cannot request camera permission inheriting from the parent — additional clickjacking defense.

### References
- W3C Permissions Policy spec
- OWASP Secure Headers Project

---

## Frontend hardening checklist

- [ ] Add CSP in next.config.ts (F-01)
- [ ] Add X-Frame-Options: DENY (F-02)
- [ ] Add HSTS (F-03)
- [ ] Add Permissions-Policy (F-11)
- [ ] Self-host MediaPipe WASM or add SRI (F-04)
- [ ] Apply referrerPolicy="no-referrer" to all avatar img (F-05)
- [ ] Confirm production sourcemaps are off (F-10)
