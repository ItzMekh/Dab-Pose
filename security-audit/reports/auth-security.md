# Authentication & Session Security

Tag prefix `AU-NN`.

## Summary

| Finding | Severity |
|---|---|
| AU-01 No email verification on credentials signup | Medium |
| AU-02 No CAPTCHA / bot challenge on signup or login | Medium |
| AU-03 Auth.js v5 is in **beta** (5.0.0-beta.31) | Medium |
| AU-04 Account deletion does not invalidate the JWT cookie | Medium (= C-11) |
| AU-05 JWT background DB sync amplifies DB load | Medium (= C-04) |
| AU-06 Password minimum 8 chars, no breach check | Low (= C-17) |
| AU-07 Google profile picture URL stored verbatim, rendered as `<img src>` | Low |
| AU-08 `pages.signIn: '/login'` but no custom error / verifyRequest pages | Low |
| AU-09 `trustHost: true` is necessary but mass-loose in dev | Info |
| AU-10 Username regex inconsistency between anonymous and authenticated paths | Low |
| AU-11 No MFA / 2FA on any account | Low |
| AU-12 Generic login error message — correctly anti-enumeration | Pass |
| AU-13 bcrypt cost factor 12 | Pass |
| AU-14 Owner-only check on `/api/profile/settings` is sound | Pass |
| AU-15 Generic 401 + 404 fall-through on `/profile/me` server redirect | Pass |

---

## AU-01 — No email verification on credentials signup

### Severity
**Medium**

### Affected files
- `src/app/api/auth/signup/route.ts:55-99`

### Description
Signup accepts any email pattern that matches the regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. No verification email is sent. The user is logged in immediately after signup (`signIn('credentials', ...)` in the client at `src/app/(auth)/signup/page.tsx:50`).

### Risk scenario
- An attacker can create accounts with arbitrary email addresses they do not control.
- Impersonation: register `someone@<their-employer>.com`, then post offensive scores to drag the victim's name through the leaderboard.
- Account takeover prevention for the real owner is also degraded: there's no "password reset" path at all (the login page literally says "Forgot password? Sign in with Google instead"), so the real owner can never reclaim a squatted email.

### Recommended fix
- Send a verification email on signup; gate score submission behind verification.
- Or, treat unverified accounts as anonymous-with-a-nickname (no profile, no badge), and only unlock features after verification.

If the project intentionally avoids email infrastructure: at minimum, store `emailVerifiedAt = null` and surface "Unverified" in the public profile UI. This stops the impersonation flow cold because nothing the unverified account does affects another person's real identity.

### References
- OWASP ASVS L1 — V2.1.10 (Identity Proofing)
- OWASP A07:2021 — Identification and Authentication Failures

---

## AU-02 — No CAPTCHA / bot challenge on signup or login

### Severity
**Medium**

### Affected files
- `src/app/api/auth/signup/route.ts`
- `src/auth.ts:24-37` (credentials provider)
- `src/app/(auth)/login/page.tsx`

### Description
The signup limiter is 5 attempts / 60 s per IP. Login is the Auth.js Credentials handler which has **no rate limit**. A distributed credential-stuffing attack can hit `/api/auth/callback/credentials` from a botnet at sub-5-rps per IP and stay below the radar.

### Risk scenario
- Credential stuffing against `/api/auth/callback/credentials` (Auth.js's underlying handler) is the obvious one.
- The bcrypt `compare(password, hash)` runs at cost 12 (~250 ms on a Fluid Compute instance) — this is itself a DoS amplification path. 100 parallel guesses cost the function ~25 s of CPU.

### Recommended fix
1. Add Vercel BotID (free on Hobby, GA since June 2025) on the signup and login forms.
2. Apply `signupLimiter` semantics — but keyed by **email** as well as IP — on the credentials callback:
   ```ts
   // proxy /api/auth/callback/credentials through a custom rate-limit middleware
   ```
3. Or add a 4th Upstash limiter `loginLimiter` keyed by `email`, 5/300s, fail-open with a hard 10/300s/IP fallback.

Vercel BotID + the existing IP limiter is probably the lightest-touch option.

### References
- OWASP ASVS L1 — V2.2.3
- CWE-307 — Improper Restriction of Excessive Authentication Attempts
- Vercel BotID docs

---

## AU-03 — Auth.js v5 is in beta (5.0.0-beta.31)

### Severity
**Medium**

### Description
`next-auth` is pinned to `^5.0.0-beta.31`. Beta releases:
- May change cookie format / JWT encoding between releases.
- Have a history of subtle security regressions during the v5 development cycle (e.g. `InvalidCheck` on PKCE handling earlier in the beta series — see `auth_errors_reference.md`).
- The caret operator `^5.0.0-beta.31` resolves to any 5.0.0-beta.X release per npm semver rules, which means `npm install` on a fresh checkout could pull a later beta with unexpected differences.

### Risk scenario
- A future beta bump introduces a session-cookie regression and the team auto-installs it.

### Recommended fix
- Pin the exact version: `"next-auth": "5.0.0-beta.31"` (no caret).
- Subscribe to Auth.js release notes; review every bump in a PR before merging.
- Plan a migration to the v5 GA when it lands.

### References
- Anthropic / Vercel guidance: avoid `^` for pre-release ranges.

---

## AU-07 — Google profile picture URL stored verbatim, rendered as `<img src>`

### Severity
**Low** (acceptable threat model)

### Affected files
- `src/auth.ts:69-73` (writes `avatarUrl: profile.picture as string`)
- `src/components/leaderboard/UserCell.tsx:14-20` (renders with `referrerPolicy="no-referrer"`)
- `src/components/profile/ProfileSidebar.tsx:61, 99-103` (renders **without** `referrerPolicy`)
- `src/components/landing/ProfileCard.tsx:61` (renders **without** `referrerPolicy`)

### Description
Google's `profile.picture` is an arbitrary HTTPS URL controlled by Google. It is trusted by spec but the URL itself leaks the page's `Referer` to Google on every page load, and to whatever origin Google's CDN may redirect to. `UserCell.tsx` adds `referrerPolicy="no-referrer"`; the other two render sites do not.

### Risk scenario
- Tracking: Google sees which pages on `dabpose.fun` an authenticated user is viewing (via the avatar request's Referer header). Mostly informational; minor PII leak.
- If Google ever served a picture URL that redirected through an attacker-controlled redirector, that attacker would receive the Referer.

### Recommended fix
1. Apply `referrerPolicy="no-referrer"` uniformly on every `<img src={avatarUrl}>` site.
2. Validate the URL on write: `new URL(profile.picture as string)` and reject non-HTTPS; restrict host to `*.googleusercontent.com`.
3. Even better: proxy the avatar through `/api/avatar/<userId>` so the browser never talks to Google directly. Same-origin only.

### References
- OWASP A04 — Insecure Design (third-party content rendering)
- W3C Referrer Policy spec

---

## AU-08 — `pages.signIn: '/login'` only; no `error`, `verifyRequest`, `signOut`

### Severity
**Low**

### Affected files
- `src/auth.ts:134`

### Description
Auth.js will fall back to its default error page (`/api/auth/error`) when something goes wrong. The default page exposes error codes (`Configuration`, `OAuthAccountNotLinked`, etc.) directly. Some of those codes leak whether an email is in use.

### Recommended fix
Add `pages: { signIn: '/login', error: '/login?err=auth' }` and surface a generic error on `/login` so the URL parameter is the only signal.

---

## AU-09 — `trustHost: true`

### Severity
**Info**

### Description
`trustHost: true` is required because the app runs behind Vercel's load balancer and inspects `host` for the Auth.js callback URL. Without it, OAuth callbacks fail on preview deployments. Acceptable on Vercel; documented for future migration awareness.

### Risk scenario
On a non-Vercel host without a trusted reverse proxy stripping `Host` injection, this would allow an attacker to craft a `Host: attacker.com` header and have Auth.js emit redirects/cookies against the attacker's domain.

### Recommended fix
Document in `CLAUDE.md` that `trustHost: true` is Vercel-dependent. If migrating, set it to `false` and explicitly list `AUTH_TRUST_HOST=true` only when the runtime can prove `Host` is trusted.

### References
- Auth.js v5 migration notes

---

## AU-10 — Username regex inconsistency between anonymous and authenticated paths

### Severity
**Low**

### Affected files
- `src/lib/api.ts:5`: `/^[a-zA-Z0-9_\- ]{1,20}$/` (allows hyphen + space, 1-char minimum)
- `src/app/api/score/route.ts:12`: same as above for anonymous submissions
- `src/app/api/auth/signup/route.ts:8`: `/^[a-zA-Z0-9_]{3,20}$/` (no hyphen/space, 3+ chars)
- `src/app/api/profile/settings/route.ts:11`: same as auth/signup

### Description
Anonymous score submissions can use usernames like `a`, `a-b`, `hello world` — but signing up later with the same username fails because the auth path is stricter. The same person who set a leaderboard #1 as `a-fast-one` then signs up and is forced to pick a different name.

There's no consistent style guide. The `valid` namespace for anonymous players is a strict superset of the authenticated namespace.

### Recommended fix
- Pick one regex. `/^[a-zA-Z0-9_]{3,20}$/` is the safer choice (no space, prevents trim-confusion, no hyphen ambiguity with route segments).
- Apply on the anonymous path too. Cap the API's `lib/api.ts` minimum to 3 characters.
- Migrate existing 1- or 2-character names with a one-off cleanup script (rename `x` → `x_user`).

### References
- OWASP A04 — Insecure Design (inconsistent validation)

---

## AU-11 — No MFA / 2FA on any account

### Severity
**Low** (acceptable for the threat model of a leaderboard game)

### Description
No TOTP, no WebAuthn, no email-based 2FA.

### Recommended fix
If the leaderboard becomes a competitive setting with prizes, add WebAuthn (passkeys) — supported on every modern browser, no shared secret.

---

## AU-13 — bcrypt cost factor 12 — PASS

bcrypt cost 12 is `~250–400 ms` per hash on a modest CPU. Appropriate for 2026. No action.

### References
- OWASP Password Storage Cheat Sheet

---

## AU-15 — Server-side ownership lookup on `/profile/me` — PASS

`src/app/profile/me/page.tsx` resolves the redirect target by `SELECT users.username WHERE users.id = session.user.id`, not by reading the JWT's `name` field. This correctly avoids the historical Bug 6 (`MEMORY.md` → `bugs_auth_profile.md`) where a stale JWT would have redirected to a wrong profile path. No action.

---

## Cross-cutting

### Cookie attributes
The default Auth.js v5 session cookie carries `Secure; HttpOnly; SameSite=Lax`. The `__Secure-` cookie prefix is applied in production. These defaults are not overridden in `src/auth.ts`. **Pass.**

### Session secret
`AUTH_SECRET` is required by Auth.js v5; expected to be set in Vercel's project env. Cannot verify from code alone — flag for owner confirmation.

### Open-redirect on `callbackUrl`
The codebase passes `callbackUrl: '/'` hard-coded. Auth.js's internal callback URL validation rejects external hosts. **Pass** — but document not to plumb arbitrary `callbackUrl` from query strings.
