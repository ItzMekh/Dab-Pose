# Dab Pose — Profile, Country & Auth Design Spec
**Date:** 2026-05-14  
**Status:** Approved

---

## Overview

Three phases adding country tracking, authentication, and player profiles to Dab Pose. Each phase ships independently and delivers value immediately.

```
Phase 1: Country + Global Counter   (no auth dependency)
Phase 2: Auth (signup / login)
Phase 3: Profile Dashboard          (depends on Phase 2)
```

---

## Database Architecture

### Split storage: Redis + Neon Postgres

**Redis (Upstash — unchanged role):** leaderboards, global counter, rate limiting
- Real-time sorted sets for leaderboards remain in Redis — no latency change
- Score submit still pipelines into Redis first, Postgres write happens in parallel via `Promise.all`

**Neon Postgres (new):** user accounts, score history
- ORM: **Drizzle ORM** — type-safe schema, migration files, works natively with Vercel + Neon
- Driver: `@neondatabase/serverless` HTTP driver — built-in PgBouncer connection pooling
- Latency: warm ~2–10ms, cold start ~100–200ms (only affects user/history reads, not leaderboard)
- Free tier: 0.5 GB storage — sufficient for thousands of users

### Postgres Schema (Drizzle)

```ts
// users
export const users = pgTable('users', {
  id:            uuid('id').primaryKey().defaultRandom(),
  email:         text('email').unique().notNull(),
  username:      text('username').unique().notNull(),
  passwordHash:  text('password_hash'),          // NULL = Google-only account
  googleId:      text('google_id').unique(),
  avatarUrl:     text('avatar_url'),
  country:       char('country', { length: 2 }).notNull().default('XX'),
  createdAt:     timestamp('created_at').defaultNow(),
})

// score history (per authenticated user)
export const scores = pgTable('scores', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  username:    text('username').notNull(),        // snapshot at submit time
  mode:        text('mode').notNull(),            // 'single' | 'streak'
  timeMs:      integer('time_ms'),
  count:       integer('count'),
  country:     char('country', { length: 2 }).notNull().default('XX'),
  rankGlobal:  integer('rank_global'),            // snapshot at submit time
  rankCountry: integer('rank_country'),           // snapshot at submit time
  createdAt:   timestamp('created_at').defaultNow(),
}, (t) => [
  index('scores_user_created_idx').on(t.userId, t.createdAt.desc()),
  index('scores_country_mode_idx').on(t.country, t.mode, t.createdAt.desc()),
])
```

### Redis Keys (unchanged + Phase 1 additions)

| Key | Type | Description |
|---|---|---|
| `lb:single:*` | ZSET | Existing single leaderboards |
| `lb:streak:*` | ZSET | Existing streak leaderboards |
| `lb:stats:plays` | STRING | Global play counter |
| `lb:country:all` | ZSET | Country all-time total dabs |
| `lb:country:week:{Www}` | ZSET | Country weekly, TTL 14d |
| `lb:country:today:{date}` | ZSET | Country daily, TTL 2d |

User keys (`user:{id}`, `user:email:{email}`, `user:username:{name}`) previously planned for Redis are **replaced by Postgres**.

### Score submit flow (with Neon)

```ts
await Promise.all([
  redis.pipeline(/* ZADD leaderboards + ZINCRBY country + INCR plays */),
  db.insert(scores).values({ userId, mode, timeMs, country, ... }),
])
// SSE push after both resolve
```

---

## Phase 1 — Country & Global Counter

### Global DAB Counter

- Already partially exists as `lb:stats:plays` (INCR per game)
- Rename display copy from "X PLAYERS" → "X DABS worldwide"
- **Placement:** Landing screen (below subtitle) + Leaderboard page (hero section above tabs)
- Refreshes via existing SSE mechanism

### Country Detection

- Server reads `x-vercel-ip-country` header (Vercel sets this automatically, no external API needed)
- Returns ISO 3166-1 alpha-2 code (e.g. `"TH"`, `"US"`)
- **Fallback:** If header absent or `"XX"` → default to `"Global"` silently, no popup
- User can override in Settings (Phase 3) or via a small selector on the result screen

### Country on Score Submit

- `POST /api/score` accepts optional `country?: string` (2-char ISO code or `"Global"`)
- Client calls `GET /api/country/detect` once on mount, caches in `sessionStorage`
- If user not logged in: country attached to score anonymously
- Country stored in score JSON (existing `Score` type gains `country` field)

### Country Leaderboard

New tab **"🌍 Countries"** added to existing `/leaderboard` page alongside Single / Streak.

**Layout:** Flag + Rank rows with % progress bar (approved design)
- Each row: rank number + flag emoji + country name + total dabs count + % share bar
- Bar width = `(countryDabs / totalDabs) * 100%` — absolute percentage, not relative to #1
- `#1` row: purple highlight gradient + 👑 "KING DAB NATION"
- Period filter: All Time / This Week / Today (same as existing leaderboard)
- Bottom pill: "You're dabbing for 🇹🇭 Thailand — 33% of all dabs 👑" (if detected)

**SSE:** New event type `country_updated` pushed when a score is submitted, triggers country tab refresh.

### New Redis Keys (Phase 1)

```
lb:country:all                ZSET  member=countryCode  score=totalDabs
lb:country:week:{Www}         ZSET  member=countryCode  score=totalDabs  TTL=14d
lb:country:today:{YYYY-MM-DD} ZSET  member=countryCode  score=totalDabs  TTL=2d
```

Score pipeline on submit: existing 3× ZADD + 2× EXPIRE + INCR, plus `ZINCRBY` on 3 country keys — all in one Upstash pipeline (one HTTP roundtrip).

### New API Routes (Phase 1)

```
GET  /api/country/detect          → { country: "TH" }  (reads Vercel header)
GET  /api/leaderboard?mode=country&period=all|week|today
```

---

## Phase 2 — Auth System

### Stack

- **Auth.js v5** (next-auth) — Credentials provider + Google provider
- **JWT sessions** (`strategy: "jwt"`) — zero DB lookup per request, session verified client-side
- **bcryptjs** — password hashing (cost factor 12)
- **Drizzle ORM** — user reads/writes against Neon Postgres

### Pages

| Path | Description |
|---|---|
| `/login` | Split screen: branding + global counter left, form right |
| `/signup` | Same split layout, form: name + email + password + confirm |

**Login page left panel:** Dab Pose logo + tagline + live global counter  
**Login page right panel:** Google button → divider → email/password form → forgot password link

**Sign In entry point on Home:** Text link below "Let's Go 🙌" button:  
`Track your dabs — Sign in / Create account` (small, `text-gray-500`, not a full button)

### Auth Flow

```
Guest:   Play → submit score with username string (unchanged)
Login:   Play → submit score includes userId → row inserted in scores table
Google:  One-click → auto-create user row if email not seen before
```

No forced login. Users access full game without an account.

### Username Rules

- 3–20 characters, alphanumeric + underscore
- Uniqueness enforced at DB level (`UNIQUE` constraint) + checked before insert
- **Collision:** block + suggest 3 alternatives (append number or country suffix, e.g. `MekhDab → MekhDab2, MekhDab_TH, MekhDab99`)

### Email/Password

- Min 8 chars, no complexity rules for MVP
- No email verification for MVP (add post-launch)
- Password reset: "forgot password" link → out of scope for MVP, show "contact support" placeholder

### Profile Picture

- **Google OAuth users:** use Google profile picture URL (stored in `users.avatar_url`, no file storage)
- **Email/password users:** letter avatar (first char of username, colour deterministically derived from username hash)
- **Future enhancement:** client-side canvas resize to 200×200 JPEG (~10 KB), upload to Vercel Blob

---

## Phase 3 — Profile Dashboard

### URL Structure

```
/profile/[username]   Public profile (anyone can view)
/profile/me           Redirect → /profile/{session.username}
```

### Layout: Sidebar + Main

**Sidebar (fixed, 160px):**
- Avatar (Google photo or letter avatar)
- Username + country flag
- Rank badges (best Single rank in country, best Streak rank globally)
- Navigation: Overview · History · Settings
- Joined date

**Main content — Overview tab:**
- Best reaction time (ms) + percentile hint ("top X% globally")
- Best streak count
- Secondary row: Total plays · Country rank · Global rank
- Recent games (last 5): mode icon + result + "PB" badge if personal best + time ago

**Main content — History tab:**
- Paginated list of all scored games (20 per page, cursor-based on `created_at`)
- Each item: mode icon + result + rank at submission time + date
- Filter by mode (All / Single / Streak) — SQL `WHERE mode = ?`

**Main content — Settings tab:**
- Change username (uniqueness check via DB, suggests alternatives on conflict)
- Change country (dropdown, overrides IP detection going forward — updates `users.country`)
- Change password (current + new + confirm — email users only, `passwordHash` not null check)
- Delete account (confirmation required; `users` row deleted, `scores.user_id` set to NULL via `ON DELETE SET NULL`; leaderboard entries in Redis remain as anonymous username strings)

### Profile Data Queries

```ts
// Overview: aggregate from scores table
db.select({
  bestTime: min(scores.timeMs),
  bestStreak: max(scores.count),
  totalPlays: count(),
}).from(scores).where(eq(scores.userId, id))

// History: paginated, filterable
db.select().from(scores)
  .where(and(eq(scores.userId, id), modeFilter))
  .orderBy(desc(scores.createdAt))
  .limit(20).offset(cursor)
```

### Public Profile Visibility

All profile data on `/profile/[username]` is public. No private/public toggle for MVP.  
Settings tab only rendered for the authenticated owner (server component with session check).

---

## Extended `Score` type

```typescript
export interface Score {
  id: string
  username: string
  time_ms: number | null
  count: number | null
  mode: 'single' | 'streak'
  created_at: string
  country?: string      // ISO 3166-1 alpha-2 or "Global"  ← new Phase 1
  userId?: string       // present when submitted by logged-in user  ← new Phase 2
}
```

---

## Testing Requirements

Each phase must pass before commit + deploy:

**Phase 1:**
- Country detection returns correct code from Vercel header, falls back to "XX" correctly
- Country leaderboard sorted correctly, TTLs set on weekly/daily keys
- Redis pipeline includes `ZINCRBY` on all 3 country keys
- Period filter (all/week/today) returns correct data
- SSE pushes `country_updated` event on score submit

**Phase 2:**
- Signup inserts user row, hashes password, enforces unique email + username
- Duplicate email → 409 error
- Duplicate username → 409 + 3 alternatives returned
- Google OAuth creates user row on first login, reuses on second (same `googleId`)
- JWT session verified without DB roundtrip
- Login with wrong password → 401
- Score submit with valid session writes row to `scores` table with correct `userId`

**Phase 3:**
- `/profile/[username]` returns 404 for unknown user
- `/profile/me` redirects to correct username when logged in
- `/profile/me` returns 401 when not logged in
- Overview aggregates (bestTime, bestStreak, totalPlays) correct against seed data
- History paginates correctly (20 items, cursor advances)
- History mode filter returns only matching rows
- Settings: username change updates `users.username`, rejects duplicate
- Settings: delete account sets `scores.user_id = NULL`, removes `users` row

---

## Future Enhancements (Out of Scope for MVP)

- Profile picture upload (canvas resize → Vercel Blob)
- Email verification on signup
- Password reset via email
- Badges / achievements system
- Country suggestions shown on result screen ("You ranked #3 in Thailand!")
