# Project Overview — Dab Pose

**Audit date:** 2026-05-18
**Auditor:** Claude (Opus 4.7) under owner authorization
**Repository:** `/Users/m3kh/Projects/Dab Pose`
**Production domain:** `dabpose.fun` (alias of `dab-pose.vercel.app`)
**Owner:** เมฆ (pupha.mekh@gmail.com)

## 1. Purpose

Dab Pose is a browser-based reaction game. The user's webcam stream feeds Google MediaPipe Holistic (WASM) entirely on-device, which extracts 33 pose landmarks per frame. A geometric detector classifies the "dab" gesture (one bent arm near the face, the other arm raised and extended). Two modes:

- `single` (**Reflex Dab**) — fastest reaction time after a randomized "GO" signal.
- `streak` (**Dab Rush**) — max number of confirmed dabs in 30 s.

Scores submit to a global + weekly + daily leaderboard with country rollups.

## 2. Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 15.5.18 |
| Runtime | Node.js (Fluid Compute on Vercel) | 24 LTS (Vercel default) |
| Language | TypeScript | 5.9.3 |
| UI | React + Framer Motion + Tailwind v4 + Lucide | React 19 |
| Auth | NextAuth v5 (beta.31) — Google OAuth + Credentials | 5.0.0-beta.31 |
| ORM | Drizzle ORM (Neon HTTP) | 0.45.2 |
| Database | Neon Postgres (serverless) | — |
| Cache / leaderboard | Upstash Redis (REST) | client 1.38 |
| Rate limit | @upstash/ratelimit (sliding window) | 2.0.8 |
| Password | bcryptjs cost 12 | 3.0.3 |
| Pose detection | MediaPipe Holistic 0.5.1675471629 (WASM, jsdelivr CDN) | — |
| Hosting | Vercel (Fluid Compute) | — |
| WAF | Vercel WAF (3 rules, Hobby plan) | — |
| Analytics | @vercel/analytics + @vercel/speed-insights | — |
| Test | Playwright 1.52 (4 specs) | — |

## 3. Repository layout

```
src/
  auth.ts                       — NextAuth config (Google + Credentials)
  app/
    layout.tsx                  — root layout (Geist, Analytics, SpeedInsights, Providers)
    page.tsx                    — landing → game screen
    loading.tsx / error.tsx / not-found.tsx
    sitemap.ts
    (auth)/{login,signup}/      — credential auth pages
    leaderboard/page.tsx
    profile/me/page.tsx         — server-side redirect to /profile/<username>
    profile/[username]/page.tsx — public profile + Owner-only Settings
    privacy/page.tsx / terms/page.tsx
    api/
      auth/[...nextauth]/route.ts  — handler proxy
      auth/signup/route.ts         — credentials signup
      score/route.ts               — score submission (single + streak)
      leaderboard/route.ts         — public leaderboard read
      stats/route.ts               — global counters
      events/route.ts              — SSE (live counter ticker)
      country/detect/route.ts      — IP-based country code
      profile/[username]/route.ts
      profile/[username]/history/route.ts
      profile/me/route.ts
      profile/settings/route.ts    — PATCH (username/country/password) + DELETE account
  components/
    game/   — CameraFeed, GameScreen, ResultScreen, StreakResultScreen, GameTimer, StreakHUD, TutorialOverlay, CountryChip
    landing/— LandingScreen, ProfileCard, UsernameSetupModal
    leaderboard/ — Leaderboard, CountryLeaderboard, UserCell
    profile/— ProfileSidebar, OverviewTab, HistoryTab, SettingsTab
    auth/   — AuthBrandPanel
    ui/     — GlobalCounter, cn
    ErrorBoundary.tsx, Providers.tsx (SessionProvider)
  hooks/
    useBrowserCompat, useCamera, useCountry, useFPS, useRealtimeVersion,
    useStableKeyboardShortcuts, useUsername
  lib/
    api.ts                — client-side leaderboard + submitScore helpers
    countries.ts          — full ISO list for the SettingsTab select
    csrf.ts               — Origin/Referer same-origin guard
    dab-detector.ts       — geometric pose classifier
    db.ts                 — Drizzle + Neon client
    game-state.ts         — finite-state transition graph
    mediapipe.ts          — lazy WASM loader (jsdelivr CDN)
    ratelimit.ts          — Upstash limiters + clientIp helpers
    redis.ts              — Upstash REST client + week/day/country key helpers
    rename-leaderboard.ts — rewrites Redis leaderboard members on username change
    schema.ts             — Drizzle tables (users, scores)
  types/
    index.ts              — domain types
    next-auth.d.ts        — module augmentation for session.user.id + needsUsernameSetup
```

70 TS/TSX files in `src/`. Cross-origin CDN scripts: MediaPipe WASM from jsdelivr (pinned tag).

## 4. Data model

### Postgres (`users` table)
| column | type | constraint |
|---|---|---|
| id | uuid (defaultRandom) | PK |
| email | text | unique, not null |
| username | text | unique, not null |
| password_hash | text | nullable (Google-only users are null) |
| google_id | text | unique, nullable |
| avatar_url | text | nullable (raw URL from Google) |
| country | char(2) | not null, default 'XX' |
| created_at | timestamp (defaultNow) | — |
| username_changed_at | timestamp | nullable (cooldown anchor) |

### Postgres (`scores` table)
| column | type | constraint |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, ON DELETE SET NULL |
| username | text | not null (snapshot at time of play) |
| mode | text | not null ('single' or 'streak') |
| time_ms | integer | nullable |
| count | integer | nullable |
| country | char(2) | not null, default 'XX' |
| rank_global | integer | nullable (snapshot) |
| rank_country | integer | nullable |
| created_at | timestamp | — |

Indexes: `(user_id, created_at desc)`, `(country, mode, created_at desc)`.

### Redis (sorted sets — `automaticDeserialization: false`)
All members are JSON-serialized snapshot objects: `{ id, userId, username, time_ms, count, mode, created_at, country }`.

| key | score | TTL | use |
|---|---|---|---|
| `lb:single:all` | time_ms (asc, lowest = #1) | none | all-time single |
| `lb:single:week:<YYYY-Www>` | time_ms | 14d | weekly single |
| `lb:single:today:<YYYY-MM-DD>` | time_ms | 2d | daily single |
| `lb:streak:all` | count (desc, highest = #1) | none | all-time streak |
| `lb:streak:week:<YYYY-Www>` | count | 14d | weekly streak |
| `lb:streak:today:<YYYY-MM-DD>` | count | 2d | daily streak |
| `lb:country:all` | totalDabs | none | country rollup |
| `lb:country:week:<YYYY-Www>` | totalDabs | 14d | weekly country |
| `lb:country:today:<YYYY-MM-DD>` | totalDabs | 2d | daily country |
| `lb:stats:plays` | INCR counter | none | total plays |
| `lb:stats:dabs` | INCR counter | none | total individual dabs |

Plus rate-limit keys: `rl:signup`, `rl:settings`, `rl:pwchange`, `rl:events` (Upstash-managed).

## 5. Trust boundaries

```
[Browser]                                     [Vercel Edge]                  [Functions]                  [Data stores]
─────────                                     ──────────────                  ───────────                  ─────────────
  ↓ webcam (local)                                ↓ WAF                          ↓ Auth.js JWT            ↓ Neon PG (HTTPS)
  ↓ MediaPipe (WASM, jsdelivr)                    ↓ ip-country header            ↓ Drizzle                ↓ Upstash REST
  ↓ fetch JSON → API                              ↓ x-forwarded-for              ↓ bcrypt                 ↓ Redis sorted sets
                                                                                  ↓ Upstash ratelimit
```

External trust dependencies:
- `cdn.jsdelivr.net` — MediaPipe WASM (loaded at runtime, **no SRI**)
- Google OAuth 2 (sign-in)
- Vercel infrastructure (signed `x-vercel-ip-country` header is trusted)
- Upstash Redis (REST)
- Neon Postgres (HTTPS)
- Google avatar URLs (stored verbatim from `profile.picture`, rendered as `<img src>`)

## 6. Authentication & authorization model

- Session: JWT (Auth.js v5 strategy), background-refreshed from DB every ≥5 s.
- Anonymous play **is allowed** for score submission (`/api/score` accepts unauthenticated clients). Usernames from the client are validated by regex.
- Authenticated submissions ignore the client-provided username; the server re-resolves it from `users.username` via `session.user.id`.
- Authorization is per-user, owner-only on `/api/profile/settings` (PATCH + DELETE) and the `settings` tab UI.
- No role/admin model. All authenticated users have identical capabilities.
- No email verification on credentials signup.
- No CAPTCHA on signup or login.

## 7. Defense layers already in place (baseline)

- Vercel WAF (3 rules, Hobby plan limit):
  1. Rate-limit `/api/score` POST — 30 req/60 s/IP (enforce mode per local memory).
  2. Block exploit probes (`/wp-admin`, `/.env`, `/.git/config`, `/phpmyadmin`, `/wp-login.php`, `/.aws/credentials`, `/.ssh/id_rsa`) — Deny.
  3. Log signup POSTs.
- App-level rate limiters (Upstash sliding window):
  - signup: 5/60 s/IP, **fail closed**
  - settings: 10/60 s/user, fail open
  - password change: 3/300 s/user, **fail closed**
  - events SSE: 10/60 s/IP, fail open
- CSRF: `isSameOrigin(req)` Origin/Referer check on `/api/score` POST, `/api/profile/settings` PATCH+DELETE.
- bcrypt cost 12.
- `X-Content-Type-Options: nosniff` on `/api/score`, `/api/leaderboard`, `/api/stats`, `/api/country/detect`.
- `referrerPolicy="no-referrer"` on `UserCell.tsx` avatar `<img>` (but not on `ProfileSidebar.tsx` / `ProfileCard.tsx`).
- Username regex on the authenticated path (`/^[a-zA-Z0-9_]{3,20}$/`) — strict.
- All Drizzle queries are parameterized.
- Generic login error ("Invalid email or password") avoids account enumeration.
- Cache-Control headers on read endpoints (`s-maxage=10–30`).

## 8. Out of scope

- Mobile app (none)
- Third-party clients
- Penetration testing of the live production deployment
- Vercel internal infrastructure
- Neon / Upstash internal infrastructure
- Google OAuth provider
