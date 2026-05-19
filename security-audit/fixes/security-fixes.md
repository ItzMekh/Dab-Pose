# Security Fixes — Proposed Patches

This file documents every recommended source change. **No file in `/Users/m3kh/Projects/Dab Pose/src` has been modified by this audit.** All patches are written here as diffs/snippets ready for the owner to apply.

Each fix is keyed to a finding tag (C-, A-, AU-, F-, D-, I-, DP-).

---

## Priority 1 — High severity / quick win

### Fix-F-01 / Fix-F-02 / Fix-F-03 / Fix-F-11 — Security response headers

**File**: `next.config.ts` — full replacement.

```ts
import type { NextConfig } from 'next'

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

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspDirectives },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig
```

After deploying, run the **CSP smoke test** locally and on production:
1. Sign in with Google + Credentials.
2. Play one round in both modes; submit a score.
3. Open DevTools Console — confirm no `Refused to load` warnings.
4. If warnings appear, add the violating origin to the relevant directive **only after** confirming it is legitimate.

---

### Fix-F-04 / Fix-C-01 — MediaPipe self-host or SRI

**Two options. Pick option 1 if you control deployment size; option 2 if you want minimal change.**

#### Option 1 — Self-host (recommended)

1. Download the MediaPipe Holistic bundle once:
   ```bash
   mkdir -p public/mediapipe
   curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/" -o public/mediapipe/index.html
   # Use the listing to download each file manually, or:
   for f in holistic_solution_packed_assets_loader.js holistic_solution_simd_wasm_bin.js holistic_solution_simd_wasm_bin.wasm holistic_solution_packed_assets.data holistic_solution_wasm_bin.js holistic_solution_wasm_bin.wasm holistic.binarypb pose_landmark_full.tflite hand_landmark_full.tflite; do
     curl -L "https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${f}" -o "public/mediapipe/${f}"
   done
   ```
   (Verify the exact file list against the latest jsdelivr `index.html` listing.)

2. Update `src/lib/mediapipe.ts:32-33`:
   ```ts
   locateFile: (file) => `/mediapipe/${file}`,
   ```

3. Remove `https://cdn.jsdelivr.net` from `script-src` and `connect-src` in the CSP (Fix-F-01).

#### Option 2 — Add SRI for the loader, keep CDN

MediaPipe loads its WASM dynamically from inside the package; there is no clean SRI hook for the JS chunks. The best you can do without self-hosting:

1. Lock down `script-src` and `connect-src` to the **exact** versioned subpath:
   ```
   script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/
   connect-src 'self' https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/
   ```
2. Add a **manual** integrity check: on `loadHolistic()`, fetch the entry `.wasm` file separately, compute SHA-384, compare against a build-time-baked hash. Reject mismatch.

This is fragile because MediaPipe owns its fetcher. **Option 1 is strongly preferred.**

---

### Fix-AU-07 / Fix-F-05 — Avatar referrerPolicy

Apply `referrerPolicy="no-referrer"` to all three avatar render sites.

**`src/components/profile/ProfileSidebar.tsx:61`** — change:
```tsx
<img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 shrink-0" />
```
to:
```tsx
<img src={user.avatarUrl} alt={user.username} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 shrink-0" />
```

**`src/components/profile/ProfileSidebar.tsx:99-103`** — same `referrerPolicy="no-referrer"` addition.

**`src/components/landing/ProfileCard.tsx:61-65`** — same.

Additionally: validate the URL on write in `src/auth.ts:73`. Replace:
```ts
avatarUrl: (profile.picture as string) ?? null,
```
with:
```ts
avatarUrl: validateAvatarUrl(profile.picture as string | undefined) ?? null,
```
and add to a new file `src/lib/avatar.ts`:
```ts
const ALLOWED_AVATAR_HOSTS = new Set(['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com'])
export function validateAvatarUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    if (!ALLOWED_AVATAR_HOSTS.has(u.hostname)) return null
    return u.toString()
  } catch {
    return null
  }
}
```

---

### Fix-A-08 — `isSameOrigin` on signup

**File**: `src/app/api/auth/signup/route.ts:21-22`.

Add immediately after the function entry:
```ts
import { isSameOrigin } from '@/lib/csrf'
// ...
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // ... existing body
}
```

---

### Fix-C-11 / Fix-C-13 — DELETE account: invalidate JWT + reserve username

**File**: `src/app/api/profile/settings/route.ts:181-196` — replace with:

```ts
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Soft-delete pattern: keep the row, mark deletedAt + nullify auth fields,
  // and rewrite the username to a reserved sentinel so the public namespace
  // does not free immediately.
  const reserved = `_deleted_${session.user.id.slice(0, 8)}`
  await db.update(users)
    .set({
      email: `deleted+${session.user.id}@local`,
      passwordHash: null,
      googleId: null,
      avatarUrl: null,
      username: reserved,
      // add `deletedAt: new Date()` if you add the column
    })
    .where(eq(users.id, session.user.id))

  // Invalidate the JWT cookie so the session ends now.
  const cookieStore = await cookies()
  cookieStore.delete('authjs.session-token')
  cookieStore.delete('__Secure-authjs.session-token')

  return NextResponse.json({ ok: true })
}
```

Requires:
- `import { cookies } from 'next/headers'` at the top.
- A migration adding `users.deleted_at timestamp` (optional but recommended).
- Update profile pages to render the sentinel as "[deleted account]" rather than expose it raw.

---

### Fix-AU-01 — Email verification (gate, not block)

Minimum-touch version: add an `emailVerifiedAt` column and surface unverified status on the public profile.

```sql
ALTER TABLE users ADD COLUMN email_verified_at timestamp NULL;
```

In `src/app/api/auth/signup/route.ts` after the insert, send a one-time verify link via your transactional email provider (Resend, Postmark, Vercel's preview-link sender). Token = `crypto.randomUUID()` stored in a new `email_verifications` table keyed by `userId`, TTL 24 h.

The verify GET route flips `email_verified_at = now()` and deletes the token.

Surface `verified` flag in `/api/profile/[username]` response. Render an "(unverified)" pill in `ProfileSidebar` when not verified.

This does **not** block play. It is a soft signal that addresses the impersonation risk (AU-01) without breaking the low-friction onboarding flow.

---

## Priority 2 — Medium severity

### Fix-AU-02 — Bot challenge

Add **Vercel BotID** on the credentials signup and login forms:

```ts
// install
// npm i botid
```

In `src/app/(auth)/signup/page.tsx` and `src/app/(auth)/login/page.tsx`, wrap the form submit with a server-issued BotID token. Per Vercel BotID docs: import the client SDK, run `botid.protect()` on submit, attach the resulting header to the fetch. Reject server-side when the header is missing or invalid.

---

### Fix-A-01 — Proof-of-play token

New file `src/app/api/play/start/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { isSameOrigin } from '@/lib/csrf'

const TOKEN_TTL_SEC = 60

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const token = crypto.randomUUID()
  const issuedAt = Date.now()
  await redis.set(`play:tok:${token}`, String(issuedAt), { ex: TOKEN_TTL_SEC })
  return NextResponse.json({ token, issuedAt, ttl: TOKEN_TTL_SEC })
}
```

Then in `src/app/api/score/route.ts`, near the top of POST handling (after CSRF + auth + parse):

```ts
const { token } = body as { token?: string }
if (typeof token !== 'string' || token.length < 16) {
  return NextResponse.json({ error: 'Invalid play token' }, { status: 400, headers: SECURITY_HEADERS })
}
const issuedAtStr = (await redis.get(`play:tok:${token}`)) as string | null
if (!issuedAtStr) {
  return NextResponse.json({ error: 'Play token expired or unknown' }, { status: 400, headers: SECURITY_HEADERS })
}
await redis.del(`play:tok:${token}`)  // single-use
const issuedAt = Number(issuedAtStr)
const elapsed = Date.now() - issuedAt
// time_ms should be at most elapsed + small slack (2s for network)
if (typeof time_ms === 'number' && time_ms > elapsed + 2000) {
  return NextResponse.json({ error: 'Reaction time inconsistent with play session' }, { status: 400, headers: SECURITY_HEADERS })
}
```

Update the client (`src/lib/api.ts`) to:
1. Call `/api/play/start` at game start.
2. Submit the returned token with the score.

This blocks the trivial "POST `{ time_ms: 100 }`" attack.

---

### Fix-C-02 — Cryptographic randomness

**`src/auth.ts:65`**:
```ts
const suffix = crypto.randomUUID().slice(0, 4)
const username = `${base}_${suffix}`
```

**`src/app/api/auth/signup/route.ts:11-19`** — replace `suggestUsernames`:
```ts
function suggestUsernames(base: string, country: string): string[] {
  const b = base.slice(0, 17)
  const c = country === 'XX' ? 'user' : country.toLowerCase()
  const rand = () => {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]
  }
  return [
    `${b}${10 + (rand() % 90)}`,
    `${b}_${c}`,
    `${b}${100 + (rand() % 900)}`,
  ]
}
```

Apply the same pattern in `src/app/api/profile/settings/route.ts:15-22`.

---

### Fix-C-04 — JWT background sync — tag-based invalidation

In `src/auth.ts`, replace the background DB sync block (lines 106-123) with a Redis tag check:

```ts
// background sync — only re-pull if a rename happened
const renameTag = (await redis.get(`u:renametag:${token.id}`)) as string | null
const lastSeen = (token.renameTag as string | undefined) ?? null
if (renameTag && renameTag !== lastSeen) {
  try {
    const [dbUser] = await db.select({ username: users.username })
      .from(users).where(eq(users.id, token.id as string)).limit(1)
    if (dbUser) token.username = dbUser.username
    token.renameTag = renameTag
  } catch (err) {
    console.error('[auth] tagged sync DB error:', err)
  }
}
```

And in `src/app/api/profile/settings/route.ts` after a successful username PATCH:
```ts
await redis.set(`u:renametag:${session.user.id}`, crypto.randomUUID(), { ex: 60 * 60 * 24 })
```

Result: 1 cheap Redis `GET` per request instead of a Postgres round trip.

---

### Fix-C-10 — CSRF stricter for authenticated callers

In `src/lib/csrf.ts`, replace the `if (!candidate) return true` branch with:

```ts
if (!candidate) {
  // Allow unauthenticated callers (curl, scripts); deny if a session cookie
  // is present — a script with auth is a CSRF attempt.
  const cookie = req.headers.get('cookie') ?? ''
  return !/authjs\.session-token/.test(cookie)
}
```

---

### Fix-DP-02 — Plan Next.js 15 → 16 upgrade

Use the `vercel:next-upgrade` skill. Outline:
1. `git checkout -b chore/next-16`
2. `npx @next/codemod@latest upgrade latest`
3. Run `npm run build`. Fix lint/type issues.
4. Run `npm run test`. Fix any regressions.
5. Test the camera path manually.
6. Commit, open PR, deploy to Vercel preview, verify CSP still passes.

---

### Fix-DP-03 — Pin `next-auth` exact

In `package.json`:
```diff
-    "next-auth": "^5.0.0-beta.31",
+    "next-auth": "5.0.0-beta.31",
```
Run `npm install` to update the lockfile.

---

### Fix-DP-05 — Remove unused MediaPipe helpers

```bash
npm uninstall @mediapipe/camera_utils @mediapipe/drawing_utils
```

Then run `npm run build` to verify no regression.

---

## Priority 3 — Low / Info / hygiene

### Fix-C-09 — Remove dead code in csrf.ts

Delete `src/lib/csrf.ts:20-24` (the empty `if` block).

### Fix-C-12 — 409 on signup unique-violation race

Wrap the INSERT in try/catch and surface 409 for Postgres `23505`. See C-12 finding for the code block.

### Fix-C-14 — Validate cursor in history route

Add `Number.isNaN(d.getTime())` check before `lt()`. See C-14 finding.

### Fix-A-02 / Fix-A-04 — Light limiters on public reads

Add `Ratelimit.slidingWindow(60, '60 s')` per IP on `/api/leaderboard` and `/api/profile/[username]/*`, fail-open.

### Fix-A-03 — SSE cap + error event

In `src/lib/ratelimit.ts:33-38`:
```diff
-export const eventsLimiter = new Ratelimit({
-  redis: rlRedis,
-  limiter: Ratelimit.slidingWindow(10, '60 s'),
+export const eventsLimiter = new Ratelimit({
+  redis: rlRedis,
+  limiter: Ratelimit.slidingWindow(3, '60 s'),
```

In `src/app/api/events/route.ts`, before `controller.close()` on Redis error:
```ts
controller.enqueue(encoder.encode(`event: error\ndata: backoff\n\n`))
```

### Fix-AU-10 — Unify username regex

Pick `/^[a-zA-Z0-9_]{3,20}$/` everywhere. Update:
- `src/lib/api.ts:5`
- `src/app/api/score/route.ts:12`

Migrate any existing 1- or 2-char anonymous leaderboard entries via the scripts/ folder (cleanup-by-username pattern).

### Fix-DP-06 — Pin Node engine

In `package.json`:
```json
"engines": {
  "node": ">=20.0.0 <26.0.0"
}
```

### Fix-I-04 — Verify AUTH_SECRET in Vercel env

Owner action:
```bash
vercel env ls production | grep AUTH_SECRET
# if missing:
openssl rand -base64 32 | vercel env add AUTH_SECRET production
```

### Fix-I-06 — Re-verify WAF rules

Owner action:
```bash
vercel firewall rules ls
```
Confirm the three rules exist, the rate-limit is `enforce`, the exploit-probe rule is `deny`, the signup logger is `log`.

### Fix-I-07 — Pre-commit secret scan

```bash
brew install gitleaks
echo -e '#!/bin/sh\ngitleaks protect --staged' > .husky/pre-commit
chmod +x .husky/pre-commit
```

### Fix-I-09 — Migrate to `vercel.ts`

Replace `vercel.json` with the `vercel.ts` shape suggested in `reports/infrastructure-security.md` I-09. Headers move to platform config; consolidates with `next.config.ts` headers.

---

## Test plan

For each fix:
1. **Static**: TypeScript builds clean.
2. **Lint**: `npm run lint` passes.
3. **Unit/E2E**: `npm run test` (Playwright suite) passes.
4. **Manual smoke**:
   - Camera permission flow on Chrome, Safari, Firefox.
   - Google sign-in.
   - Credentials sign-in.
   - Score submission both modes.
   - Profile rename.
   - Account delete.
5. **CSP**: open DevTools Console, confirm no `Refused to ...` warnings.
6. **Headers**: `curl -I https://dabpose.fun/` shows the new headers.

## Apply order

1. Low-risk hygiene fixes first (DP-05, C-09, C-14, DP-06, I-07).
2. Headers (F-01..F-11) — one PR.
3. CSRF + Origin fixes (A-08, C-10) — one PR.
4. MediaPipe self-host (F-04 / C-01) — separate PR, requires asset commit.
5. JWT/session fixes (C-11 / C-13) — careful PR; test logout flow.
6. Proof-of-play token (A-01) — careful PR; coordinate client + server.
7. Auth.js v5 stabilization (DP-03) — pin then upgrade.
8. Next.js 15 → 16 (DP-02) — separate large PR.
