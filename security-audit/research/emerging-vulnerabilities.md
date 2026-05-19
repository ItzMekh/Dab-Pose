# Emerging Vulnerabilities (Project-Relevant)

A targeted, opinionated list. Only items where Dab Pose has measurable exposure.

## 1. CDN-hosted ML model tampering (Highest priority)

**Pattern**: Attackers compromise a CDN's mirror or pinned artifact; victims load tampered JS that exfiltrates DOM data or hijacks the camera.

**Project exposure**: F-04 / C-01. MediaPipe loaded from `cdn.jsdelivr.net` without SRI. The pinned tag is `0.5.1675471629`. Direct line to camera frames + same-origin fetch.

**Defense**: Self-host bundle, or add SRI. Best mitigation single-step.

## 2. Drive-by signup amplification via missing CSRF on `/api/auth/signup`

**Pattern**: An attacker hosts a page that auto-submits to a victim site's signup endpoint. With no Origin check, the browser carries any pre-existing cookies and rate-limit + bcrypt amplifies cost on the victim site.

**Project exposure**: A-08. The signup endpoint has rate-limiting but no Origin check.

**Defense**: Add `isSameOrigin(req)` at top of `/api/auth/signup`.

## 3. Reaction-score replay / forgery

**Pattern**: Game-score endpoints with no proof-of-play are trivially scriptable. The result: the leaderboard becomes meaningless within hours of public discovery.

**Project exposure**: A-01. Easily exploited today.

**Defense**: Issue a single-use HMAC-bound play token from a new `/api/play/start`, verify on `/api/score`.

## 4. Account-recycle reputation transfer

**Pattern**: Public leaderboard rows survive an account deletion; the username is freed; a new user takes it and inherits the public profile link to old scores.

**Project exposure**: C-13 / D-05.

**Defense**: Soft-delete + 30-day username reservation.

## 5. SSE-driven Redis cost amplification

**Pattern**: Long-lived SSE handlers poll Redis. A botnet sustains thousands of connections, generating billable ops/s without ever consuming a "real" feature.

**Project exposure**: A-03 / C-06.

**Defense**: Reduce poll cap and migrate to pub/sub.

## 6. JWT "ghost session" after account deletion

**Pattern**: The user deletes their account; the JWT cookie remains valid until natural expiry. The session token is still cryptographically valid but the user row is gone.

**Project exposure**: C-11.

**Defense**: Clear cookie + optional tombstone set on deletion.

## 7. Preview-deployment cookie reuse

**Pattern**: A leaked preview-deployment URL (e.g., shared accidentally on a public PR) inherits production cookies if the cookie scope was set to the apex `.vercel.app` domain — which it is not, by Auth.js v5 default. Still, anyone with a preview URL can run the full app against the preview DB if the project uses the same DB across environments (this project does — verify).

**Project exposure**: Unknown without owner confirmation. The `vercel.json` aliases include `dab-pose.vercel.app` and `dabpose.fun`. If preview deployments share the production `DATABASE_URL`, every preview link is a parallel attack surface.

**Defense**: Confirm Vercel project has separate Production / Preview env values for `DATABASE_URL` and `UPSTASH_REDIS_REST_*`. Or accept the shared-DB design and document it.

## 8. Beta dependency churn

**Pattern**: A pre-release dependency (`next-auth@^5.0.0-beta.31` here) introduces a regression mid-cycle; the team auto-installs it on a fresh checkout.

**Project exposure**: AU-03 / DP-03.

**Defense**: Pin exact version, gate dependabot bumps on PR review.

## 9. Future: Server Actions adoption regret

The project does not use Server Actions today, so the historical Server Actions advisory chain in Next.js 15 doesn't apply. **If** a future feature adopts Server Actions, ensure each action has explicit auth + CSRF gating; the framework's default token does not cover all cases that a route handler with `isSameOrigin` would.

## Items intentionally **not** flagged here

- **WebRTC TURN exposure** — the game uses local camera only, no peer connection.
- **Real-time multiplayer state desync** — single-player only.
- **Payment flows** — none.
- **File upload** — none.
- **Webhooks** — none.
- **Background workers** — none beyond Auth.js internal.
- **Email-based pwd reset** — not implemented (and not recommended without verification first; see AU-01).
