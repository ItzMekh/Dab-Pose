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
lb:country:all              ZSET  member=countryCode  score=totalDabs
lb:country:week:{Www}       ZSET  member=countryCode  score=totalDabs  TTL=14d
lb:country:today:{YYYY-MM-DD} ZSET member=countryCode score=totalDabs  TTL=2d
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
- **JWT sessions** (`strategy: "jwt"`) — no Redis session lookup per request
- **bcryptjs** — password hashing (cost factor 12)

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
Login:   Play → submit score includes userId → linked to profile
Google:  One-click → auto-create account if email not seen before
```

No forced login. Users access full game without an account.

### Username Rules

- 3–20 characters, alphanumeric + underscore
- Uniqueness enforced for accounts only (guests are unaffected)
- **Collision:** block + suggest 3 alternatives (append number or country suffix, e.g. `MekhDab → MekhDab2, MekhDab_TH, MekhDab99`)
- Reverse-lookup key: `user:username:{name} → userId`

### Email/Password

- Min 8 chars, no complexity rules for MVP
- No email verification for MVP (add post-launch)
- Password reset: "forgot password" link → out of scope for MVP, show "contact support" placeholder

### Profile Picture

- **Google OAuth users:** use Google profile picture URL (stored in `user:{id}` hash, no file storage)
- **Email/password users:** letter avatar (first char of username, colour deterministically derived from username hash)
- **Future enhancement:** client-side canvas resize to 200×200 JPEG (~10 KB), upload to Vercel Blob

### New Redis Keys (Phase 2)

```
user:{id}               HASH  → email, passwordHash, username, country, avatarUrl, createdAt
user:email:{email}      STRING → userId   (reverse lookup)
user:username:{name}    STRING → userId   (uniqueness + reverse lookup)
```

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
- Paginated list of all scored games (20 per page, infinite scroll)
- Each item: mode icon + result + rank at submission time + date
- Filter by mode (All / Single / Streak)

**Main content — Settings tab:**
- Change username (uniqueness check, suggests alternatives on conflict)
- Change country (dropdown, overrides IP detection going forward)
- Change password (current + new + confirm — email users only)
- Delete account (confirmation required, purges all user keys; existing leaderboard scores remain as anonymous entries with original username string)

### Score History Storage

```
scores:user:{userId}    ZSET  member=scoreJSON  score=timestamp_ms  (no TTL)
```

On score submit (when logged in): ZADD to existing leaderboard keys + ZADD to `scores:user:{userId}`.

### Public Profile Visibility

All profile data on `/profile/[username]` is public. No private/public toggle for MVP.  
Settings tab only visible to the authenticated owner (server component with session check).

---

## Data Model Summary

### Extended `Score` type

```typescript
export interface Score {
  id: string
  username: string
  time_ms: number | null
  count: number | null
  mode: 'single' | 'streak'
  created_at: string
  country?: string      // ISO 3166-1 alpha-2 or "Global"  ← new
  userId?: string       // present when submitted by logged-in user  ← new
}
```

### Redis Keys — Full Picture

| Key | Type | Description |
|---|---|---|
| `lb:single:*` | ZSET | Existing single leaderboards |
| `lb:streak:*` | ZSET | Existing streak leaderboards |
| `lb:stats:plays` | STRING | Global play counter |
| `lb:country:*` | ZSET | Country leaderboards (Phase 1) |
| `user:{id}` | HASH | User account (Phase 2) |
| `user:email:{email}` | STRING | Email → userId (Phase 2) |
| `user:username:{name}` | STRING | Username → userId (Phase 2) |
| `scores:user:{userId}` | ZSET | Per-user score history (Phase 3) |

---

## Testing Requirements

Each phase must pass tests before commit + deploy:

**Phase 1:**
- Country detection returns correct code from Vercel header
- Country leaderboard sorted correctly, TTLs set
- Pipeline includes country ZINCRBY
- Period filter (all/week/today) returns correct data
- SSE pushes `country_updated` on score submit

**Phase 2:**
- Signup creates user, hashes password, sets reverse-lookup keys
- Duplicate email → 409 error
- Duplicate username → 409 + 3 alternatives
- Google OAuth creates user on first login, reuses on second
- JWT session verified without Redis roundtrip
- Login with wrong password → 401

**Phase 3:**
- `/profile/[username]` returns 404 for unknown user
- `/profile/me` redirects to correct username when logged in
- `/profile/me` returns 401 when not logged in
- History paginates correctly (20 items, cursor-based)
- Settings: username change updates reverse-lookup keys atomically
- Settings: delete account removes all user keys

---

## Future Enhancements (Out of Scope for MVP)

- Profile picture upload (canvas resize → Vercel Blob)
- Email verification on signup
- Password reset via email
- Badges / achievements system
- Country suggestions shown on result screen ("You ranked #3 in Thailand!")
