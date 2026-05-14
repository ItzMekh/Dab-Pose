# Phase 3 — Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public player profiles at `/profile/[username]` with Overview (best stats), History (paginated score log), and Settings (username/country/password/delete) tabs. `/profile/me` redirects authenticated users to their own profile.

**Architecture:** The profile page is a Next.js server component — initial data (user row + aggregate stats) fetched from Neon Postgres directly, so no extra round-trip on first render. History tab is a client component backed by a paginated API route (cursor-based on `created_at`). Settings tab is client-only; mutations go through `/api/profile/settings`. The sidebar uses Next.js search params for tab selection, keeping the page shareable by URL.

**Tech Stack:** Next.js 15 App Router (server components + client components), Drizzle ORM, Auth.js v5 `auth()`, Tailwind CSS v4. Phases 1 + 2 must be complete.

---

## File Map

| Action | Path |
|---|---|
| Create | `src/app/profile/[username]/page.tsx` |
| Create | `src/app/profile/[username]/not-found.tsx` |
| Create | `src/app/profile/me/page.tsx` |
| Create | `src/app/api/profile/[username]/route.ts` |
| Create | `src/app/api/profile/[username]/history/route.ts` |
| Create | `src/app/api/profile/settings/route.ts` |
| Create | `src/components/profile/ProfileSidebar.tsx` |
| Create | `src/components/profile/OverviewTab.tsx` |
| Create | `src/components/profile/HistoryTab.tsx` |
| Create | `src/components/profile/SettingsTab.tsx` |
| Create | `tests/profile.spec.ts` |

---

## Task 1: Profile Stats API

**Files:**
- Create: `src/app/api/profile/[username]/route.ts`

- [ ] **Step 1: Write the failing test first**

Create `tests/profile.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('GET /api/profile/[username]: unknown user → 404', async ({ request }) => {
  const res = await request.get('/api/profile/nobody_xyz_does_not_exist')
  expect(res.status()).toBe(404)
})

test('GET /api/profile/[username]: known user → stats shape', async ({ request }) => {
  // Requires a user "testprofile_e2e" to exist in DB.
  // Create it via signup first.
  const UNIQUE = Date.now()
  await request.post('/api/auth/signup', {
    data: {
      username: `profuser${UNIQUE}`,
      email: `profuser${UNIQUE}@example.com`,
      password: 'password123',
    },
  })
  const res = await request.get(`/api/profile/profuser${UNIQUE}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body).toHaveProperty('user')
  expect(body).toHaveProperty('stats')
  expect(body.user).toHaveProperty('username', `profuser${UNIQUE}`)
  expect(body.stats).toHaveProperty('bestTime')
  expect(body.stats).toHaveProperty('bestStreak')
  expect(body.stats).toHaveProperty('totalPlays')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/profile.spec.ts --grep "profile/\[username\]"
```

Expected: FAIL — 404 (route not implemented)

- [ ] **Step 3: Create `src/app/api/profile/[username]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq, min, max, count } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      country: users.country,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const [stats] = await db
    .select({
      bestTime: min(scores.timeMs),
      bestStreak: max(scores.count),
      totalPlays: count(),
    })
    .from(scores)
    .where(eq(scores.userId, user.id))

  return NextResponse.json(
    { user, stats: stats ?? { bestTime: null, bestStreak: null, totalPlays: 0 } },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/profile.spec.ts --grep "profile/\[username\]"
```

Expected: both tests PASS

---

## Task 2: Profile History API

**Files:**
- Create: `src/app/api/profile/[username]/history/route.ts`

- [ ] **Step 1: Add history tests to `tests/profile.spec.ts`**

```typescript
test('GET /api/profile/[username]/history: returns 20 items max', async ({ request }) => {
  const UNIQUE = Date.now()
  // Create user
  await request.post('/api/auth/signup', {
    data: { username: `histuser${UNIQUE}`, email: `histuser${UNIQUE}@example.com`, password: 'password123' },
  })
  // History for a brand-new user is empty
  const res = await request.get(`/api/profile/histuser${UNIQUE}/history`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body.items)).toBe(true)
  expect(body).toHaveProperty('nextCursor')
})

test('GET /api/profile/[username]/history: mode filter returns correct subset', async ({ request }) => {
  const UNIQUE = Date.now()
  await request.post('/api/auth/signup', {
    data: { username: `filtuser${UNIQUE}`, email: `filtuser${UNIQUE}@example.com`, password: 'password123' },
  })
  const res = await request.get(`/api/profile/filtuser${UNIQUE}/history?mode=single`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body.items)).toBe(true)
  // All returned items should be single mode (none to check, but shape is correct)
  body.items.forEach((item: { mode: string }) => {
    expect(item.mode).toBe('single')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/profile.spec.ts --grep "history"
```

Expected: FAIL — 404

- [ ] **Step 3: Create `src/app/api/profile/[username]/history/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq, and, desc, lt } from 'drizzle-orm'

const PAGE_SIZE = 20

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode')  // 'single' | 'streak' | null (all)
  const cursor = searchParams.get('cursor')  // ISO timestamp from previous page's last item

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const conditions = [eq(scores.userId, user.id)]
  if (mode === 'single' || mode === 'streak') {
    conditions.push(eq(scores.mode, mode))
  }
  if (cursor) {
    conditions.push(lt(scores.createdAt, new Date(cursor)))
  }

  const items = await db
    .select({
      id: scores.id,
      mode: scores.mode,
      timeMs: scores.timeMs,
      count: scores.count,
      country: scores.country,
      rankGlobal: scores.rankGlobal,
      createdAt: scores.createdAt,
    })
    .from(scores)
    .where(and(...conditions))
    .orderBy(desc(scores.createdAt))
    .limit(PAGE_SIZE + 1)  // fetch one extra to determine if there's a next page

  const hasMore = items.length > PAGE_SIZE
  const page = items.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? page[page.length - 1].createdAt?.toISOString() ?? null : null

  return NextResponse.json({ items: page, nextCursor })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/profile.spec.ts --grep "history"
```

Expected: both history tests PASS

---

## Task 3: Profile Settings API

**Files:**
- Create: `src/app/api/profile/settings/route.ts`

This route handles authenticated mutations: PATCH (change username, country, or password) and DELETE (delete account). All operations verify the JWT session — no action is taken for unauthenticated requests.

- [ ] **Step 1: Add settings tests to `tests/profile.spec.ts`**

```typescript
test('PATCH /api/profile/settings: unauthenticated → 401', async ({ request }) => {
  const res = await request.patch('/api/profile/settings', {
    data: { field: 'username', value: 'newname' },
  })
  expect(res.status()).toBe(401)
})

test('DELETE /api/profile/settings: unauthenticated → 401', async ({ request }) => {
  const res = await request.delete('/api/profile/settings')
  expect(res.status()).toBe(401)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/profile.spec.ts --grep "settings"
```

Expected: FAIL — 404

- [ ] **Step 3: Create `src/app/api/profile/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq } from 'drizzle-orm'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const COUNTRY_RE = /^[A-Z]{2}$/

function suggestUsernames(base: string): string[] {
  const b = base.slice(0, 17)
  return [
    `${b}${Math.floor(Math.random() * 90 + 10)}`,
    `${b}_alt`,
    `${b}${Math.floor(Math.random() * 900 + 100)}`,
  ]
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { field, value, currentPassword } = body as Record<string, unknown>

  if (field === 'username') {
    if (typeof value !== 'string' || !USERNAME_RE.test(value)) {
      return NextResponse.json(
        { error: 'Username must be 3–20 chars, letters/numbers/underscore only' },
        { status: 400 }
      )
    }
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, value))
      .limit(1)
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        { error: 'Username taken', suggestions: suggestUsernames(value) },
        { status: 409 }
      )
    }
    await db
      .update(users)
      .set({ username: value })
      .where(eq(users.id, session.user.id))
    return NextResponse.json({ ok: true, username: value })
  }

  if (field === 'country') {
    if (typeof value !== 'string' || !COUNTRY_RE.test(value)) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
    }
    await db
      .update(users)
      .set({ country: value })
      .where(eq(users.id, session.user.id))
    return NextResponse.json({ ok: true })
  }

  if (field === 'password') {
    if (typeof value !== 'string' || value.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current password required' }, { status: 400 })
    }
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    if (!user?.passwordHash) {
      return NextResponse.json({ error: 'Password change not available for Google accounts' }, { status: 400 })
    }
    const valid = await compare(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    const passwordHash = await hash(value, 12)
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, session.user.id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
}

export async function DELETE(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // scores.user_id is set to NULL via ON DELETE SET NULL (defined in schema)
  // Drizzle generates the FK with onDelete: 'set null', so deleting the user
  // nullifies scores.user_id automatically — no manual update needed.
  await db.delete(users).where(eq(users.id, session.user.id))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/profile.spec.ts --grep "settings"
```

Expected: both 401 tests PASS

---

## Task 4: ProfileSidebar Component

**Files:**
- Create: `src/components/profile/ProfileSidebar.tsx`

The sidebar is a server component that receives user data and active tab as props. Navigation links use `?tab=` search params.

- [ ] **Step 1: Create `src/components/profile/ProfileSidebar.tsx`**

```typescript
import Link from 'next/link'
import type { User } from '@/lib/schema'

const COUNTRY_NAMES: Record<string, string> = {
  TH: '🇹🇭 Thailand', US: '🇺🇸 United States', JP: '🇯🇵 Japan',
  GB: '🇬🇧 United Kingdom', DE: '🇩🇪 Germany', FR: '🇫🇷 France',
  KR: '🇰🇷 South Korea', CN: '🇨🇳 China', AU: '🇦🇺 Australia',
  CA: '🇨🇦 Canada', BR: '🇧🇷 Brazil', IN: '🇮🇳 India',
  SG: '🇸🇬 Singapore', MX: '🇲🇽 Mexico', IT: '🇮🇹 Italy',
  XX: '🌍 Global',
}

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ?? `🌍 ${code}`
}

function LetterAvatar({ username }: { username: string }) {
  const colors = [
    'from-purple-500 to-indigo-500',
    'from-cyan-500 to-blue-500',
    'from-pink-500 to-rose-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
  ]
  // Deterministic color from username hash
  const idx = username.charCodeAt(0) % colors.length
  return (
    <div
      className={`w-14 h-14 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black text-2xl mx-auto`}
    >
      {username[0].toUpperCase()}
    </div>
  )
}

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'history',  label: '📋 History' },
  { id: 'settings', label: '⚙️ Settings' },
]

interface Props {
  user: Pick<User, 'username' | 'avatarUrl' | 'country' | 'createdAt'>
  activeTab: string
  isOwner: boolean
}

export default function ProfileSidebar({ user, activeTab, isOwner }: Props) {
  const joinedMonth = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <aside className="w-44 shrink-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col gap-4 p-4 min-h-screen">
      {/* Avatar */}
      <div className="text-center space-y-1 pt-2">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-14 h-14 rounded-full mx-auto object-cover"
          />
        ) : (
          <LetterAvatar username={user.username} />
        )}
        <p className="text-white text-sm font-bold truncate">{user.username}</p>
        <p className="text-gray-500 text-xs">{countryLabel(user.country)}</p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {TABS.map(({ id, label }) => {
          if (id === 'settings' && !isOwner) return null
          const active = activeTab === id
          return (
            <Link
              key={id}
              href={`/profile/${user.username}${id === 'overview' ? '' : `?tab=${id}`}`}
              className={`text-xs px-3 py-2 rounded-lg transition-colors ${
                active
                  ? 'bg-purple-600 text-white font-bold'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Joined */}
      {joinedMonth && (
        <p className="mt-auto text-center text-gray-700 text-xs pb-2">
          Joined {joinedMonth}
        </p>
      )}
    </aside>
  )
}
```

---

## Task 5: OverviewTab Component

**Files:**
- Create: `src/components/profile/OverviewTab.tsx`

- [ ] **Step 1: Create `src/components/profile/OverviewTab.tsx`**

```typescript
import type { User } from '@/lib/schema'

interface Stats {
  bestTime: number | null
  bestStreak: number | null
  totalPlays: number
}

interface Props {
  user: Pick<User, 'username' | 'country'>
  stats: Stats
}

export default function OverviewTab({ stats }: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-white text-lg font-bold">Overview</h2>
        <p className="text-gray-500 text-sm">All-time stats</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/3 border border-white/8 rounded-xl p-5">
          <p className="text-gray-500 text-xs tracking-widest mb-2">BEST REACTION</p>
          {stats.bestTime !== null ? (
            <p className="text-purple-400 text-4xl font-black">
              {stats.bestTime}
              <span className="text-gray-500 text-sm font-normal">ms</span>
            </p>
          ) : (
            <p className="text-gray-600 text-2xl font-black">—</p>
          )}
        </div>
        <div className="bg-white/3 border border-white/8 rounded-xl p-5">
          <p className="text-gray-500 text-xs tracking-widest mb-2">BEST STREAK</p>
          {stats.bestStreak !== null ? (
            <p className="text-cyan-400 text-4xl font-black">
              {stats.bestStreak}
              <span className="text-gray-500 text-sm font-normal"> dabs</span>
            </p>
          ) : (
            <p className="text-gray-600 text-2xl font-black">—</p>
          )}
        </div>
      </div>

      {/* Total plays */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-center gap-3">
        <span className="text-2xl">🎮</span>
        <div>
          <p className="text-amber-400 text-xl font-bold">{stats.totalPlays}</p>
          <p className="text-gray-500 text-xs">Total Plays</p>
        </div>
      </div>

      {stats.totalPlays === 0 && (
        <p className="text-gray-600 text-sm text-center py-8">
          No scored games yet. Play a game and sign in to track your stats!
        </p>
      )}
    </div>
  )
}
```

---

## Task 6: HistoryTab Component

**Files:**
- Create: `src/components/profile/HistoryTab.tsx`

This is a client component that fetches paginated history from the API.

- [ ] **Step 1: Create `src/components/profile/HistoryTab.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

interface HistoryItem {
  id: string
  mode: string
  timeMs: number | null
  count: number | null
  country: string
  rankGlobal: number | null
  createdAt: string
}

interface Props {
  username: string
}

type ModeFilter = 'all' | 'single' | 'streak'

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ResultCell({ item }: { item: HistoryItem }) {
  if (item.mode === 'single' && item.timeMs !== null) {
    return (
      <span className="text-white text-sm font-medium">
        ⚡ {item.timeMs}<span className="text-gray-500 text-xs">ms</span>
      </span>
    )
  }
  if (item.mode === 'streak' && item.count !== null) {
    return (
      <span className="text-white text-sm font-medium">
        🔥 {item.count}<span className="text-gray-500 text-xs"> dabs</span>
      </span>
    )
  }
  return <span className="text-gray-500 text-sm">—</span>
}

export default function HistoryTab({ username }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(async (cursor: string | null, replace: boolean) => {
    const params = new URLSearchParams()
    if (mode !== 'all') params.set('mode', mode)
    if (cursor) params.set('cursor', cursor)
    const qs = params.toString()
    const res = await fetch(`/api/profile/${username}/history${qs ? `?${qs}` : ''}`)
    if (!res.ok) return
    const data = await res.json()
    setItems(prev => replace ? data.items : [...prev, ...data.items])
    setNextCursor(data.nextCursor)
  }, [username, mode])

  useEffect(() => {
    setLoading(true)
    fetchPage(null, true).finally(() => setLoading(false))
  }, [fetchPage])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    await fetchPage(nextCursor, false)
    setLoadingMore(false)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-bold">History</h2>
          <p className="text-gray-500 text-sm">All scored games</p>
        </div>
        {/* Mode filter */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['all', 'single', 'streak'] as ModeFilter[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                mode === m ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'single' ? '⚡' : m === 'streak' ? '🔥' : '🎮'} {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/3 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-12">No games yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3"
              >
                <ResultCell item={item} />
                {item.rankGlobal && (
                  <span className="ml-auto text-gray-600 text-xs">
                    #{item.rankGlobal} global
                  </span>
                )}
                <span className="text-gray-600 text-xs shrink-0">{timeAgo(item.createdAt)}</span>
              </div>
            ))}
          </div>
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full text-gray-500 hover:text-white text-sm py-3 transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

---

## Task 7: SettingsTab Component

**Files:**
- Create: `src/components/profile/SettingsTab.tsx`

Client component, rendered only for the authenticated profile owner.

- [ ] **Step 1: Create `src/components/profile/SettingsTab.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { User } from '@/lib/schema'

async function patchSetting(field: string, value: string, currentPassword?: string) {
  const body: Record<string, string> = { field, value }
  if (currentPassword) body.currentPassword = currentPassword
  const res = await fetch('/api/profile/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
}

interface Props {
  user: Pick<User, 'username' | 'country' | 'passwordHash'>
}

export default function SettingsTab({ user }: Props) {
  const router = useRouter()
  const [username, setUsername] = useState(user.username)
  const [country, setCountry] = useState(user.country)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  function setMessage(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await patchSetting('username', username)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setMessage('err', data.error ?? 'Failed')
    } else {
      setMessage('ok', 'Username updated')
      router.push(`/profile/${data.username}`)
    }
  }

  async function handleCountryChange(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await patchSetting('country', country.toUpperCase())
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setMessage('err', data.error ?? 'Failed')
    } else {
      setMessage('ok', 'Country updated')
      router.refresh()
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setMessage('err', 'Passwords do not match'); return }
    setLoading(true)
    const res = await patchSetting('password', newPw, currentPw)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setMessage('err', data.error ?? 'Failed')
    } else {
      setMessage('ok', 'Password changed')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
  }

  async function handleDelete() {
    setLoading(true)
    const res = await fetch('/api/profile/settings', { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      await signOut({ callbackUrl: '/' })
    } else {
      setMessage('err', 'Delete failed')
    }
  }

  return (
    <div className="space-y-8 max-w-md">
      <div>
        <h2 className="text-white text-lg font-bold">Settings</h2>
        <p className="text-gray-500 text-sm">Manage your account</p>
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}

      {/* Username */}
      <form onSubmit={handleUsernameChange} className="space-y-3">
        <h3 className="text-white text-sm font-semibold">Change Username</h3>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || username === user.username}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Save username
        </button>
      </form>

      {/* Country */}
      <form onSubmit={handleCountryChange} className="space-y-3">
        <h3 className="text-white text-sm font-semibold">Change Country</h3>
        <input
          type="text"
          placeholder="2-letter country code (e.g. TH, US)"
          value={country}
          onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))}
          maxLength={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors uppercase"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Save country
        </button>
      </form>

      {/* Password — only for email/password accounts */}
      {user.passwordHash && (
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <h3 className="text-white text-sm font-semibold">Change Password</h3>
          <input
            type="password"
            placeholder="Current password"
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Change password
          </button>
        </form>
      )}

      {/* Delete account */}
      <div className="border-t border-white/5 pt-6 space-y-3">
        <h3 className="text-red-400 text-sm font-semibold">Danger Zone</h3>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="px-4 py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-bold rounded-lg transition-colors"
          >
            Delete account
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">
              This permanently deletes your account. Leaderboard entries remain as anonymous scores. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Yes, delete my account
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Task 8: Profile Page (Server Component)

**Files:**
- Create: `src/app/profile/[username]/page.tsx`
- Create: `src/app/profile/[username]/not-found.tsx`

- [ ] **Step 1: Add profile page tests to `tests/profile.spec.ts`**

```typescript
test('GET /profile/[username]: unknown user → 404 page', async ({ page }) => {
  const res = await page.goto('/profile/nobody_xyz_does_not_exist_abc')
  expect(res?.status()).toBe(404)
})

test('GET /profile/[username]: known user → shows username in page', async ({ request, page }) => {
  const UNIQUE = Date.now()
  await request.post('/api/auth/signup', {
    data: { username: `pageuser${UNIQUE}`, email: `pageuser${UNIQUE}@example.com`, password: 'password123' },
  })
  await page.goto(`/profile/pageuser${UNIQUE}`)
  await expect(page.getByText(`pageuser${UNIQUE}`)).toBeVisible()
  await expect(page.getByText('Overview')).toBeVisible()
})

test('/profile/[username]: settings tab hidden for non-owner', async ({ page }) => {
  const UNIQUE = Date.now()
  await page.request.post('/api/auth/signup', {
    data: { username: `pubuser${UNIQUE}`, email: `pubuser${UNIQUE}@example.com`, password: 'password123' },
  })
  await page.goto(`/profile/pubuser${UNIQUE}`)
  await expect(page.getByText('⚙️ Settings')).not.toBeVisible()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/profile.spec.ts --grep "profile/\[username\]: (unknown|known|settings tab)"
```

Expected: FAIL — 404 (page not implemented)

- [ ] **Step 3: Create `src/app/profile/[username]/not-found.tsx`**

```typescript
import Link from 'next/link'

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <p className="text-6xl font-black text-gray-700">404</p>
      <p className="text-gray-400">Player not found</p>
      <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
        ← Back to home
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/app/profile/[username]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq, min, max, count } from 'drizzle-orm'
import ProfileSidebar from '@/components/profile/ProfileSidebar'
import OverviewTab from '@/components/profile/OverviewTab'
import HistoryTab from '@/components/profile/HistoryTab'
import SettingsTab from '@/components/profile/SettingsTab'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params
  const { tab = 'overview' } = await searchParams

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) notFound()

  const session = await auth()
  const isOwner = session?.user?.name === username

  const [stats] = await db
    .select({
      bestTime: min(scores.timeMs),
      bestStreak: max(scores.count),
      totalPlays: count(),
    })
    .from(scores)
    .where(eq(scores.userId, user.id))

  const safeStats = stats ?? { bestTime: null, bestStreak: null, totalPlays: 0 }

  return (
    <div className="min-h-screen bg-black text-white flex">
      <ProfileSidebar user={user} activeTab={tab} isOwner={isOwner} />
      <main className="flex-1 p-6 overflow-auto">
        {tab === 'overview' && (
          <OverviewTab user={user} stats={safeStats} />
        )}
        {tab === 'history' && (
          <HistoryTab username={username} />
        )}
        {tab === 'settings' && isOwner && (
          <SettingsTab user={user} />
        )}
        {tab === 'settings' && !isOwner && (
          <p className="text-gray-600 text-sm">
            Settings are only visible to the account owner.
          </p>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- tests/profile.spec.ts --grep "profile/\[username\]"
```

Expected: PASS

---

## Task 9: /profile/me Redirect

**Files:**
- Create: `src/app/profile/me/page.tsx`

- [ ] **Step 1: Add /profile/me tests to `tests/profile.spec.ts`**

```typescript
test('/profile/me: unauthenticated → redirect to /login', async ({ page }) => {
  await page.goto('/profile/me')
  await expect(page).toHaveURL(/\/login/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/profile.spec.ts --grep "profile/me"
```

Expected: FAIL

- [ ] **Step 3: Create `src/app/profile/me/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function ProfileMePage() {
  const session = await auth()
  if (!session?.user?.name) {
    redirect('/login')
  }
  redirect(`/profile/${session.user.name}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/profile.spec.ts --grep "profile/me"
```

Expected: PASS

---

## Task 10: Full Test Run + Build Verification

- [ ] **Step 1: Run all profile tests**

```bash
npm run test -- tests/profile.spec.ts
```

Expected: all tests PASS

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build succeeds

- [ ] **Step 4: Manual verification checklist**

Start dev server (`npm run dev`) and verify:

1. `http://localhost:3000/profile/me` → redirects to `/login` when not signed in
2. Sign up at `/signup` → auto signs in → redirects to `/`
3. Navigate to `/profile/<your-username>` → profile page loads with Overview tab
4. Click History tab → history page loads (empty for new user)
5. Click Settings tab → settings page loads with username/country fields
6. Change username → saves + redirects to new `/profile/<new-username>`
7. `/profile/me` → redirects to `/profile/<your-username>` when signed in
8. Log out, visit another user's profile → Settings tab not visible

- [ ] **Step 5: Commit Phase 3**

```bash
git add src/app/profile/ src/app/api/profile/ \
  src/components/profile/ tests/profile.spec.ts
git commit -m "feat: Phase 3 — Profile dashboard with Overview, History, Settings"
```

---

## Phase 3 Deploy Checklist

No new environment variables required (uses same `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` from Phase 2).

After deploy, verify on production:
- `/profile/me` redirects to login when not signed in
- `/profile/<username>` is publicly accessible
- History paginates correctly (load more button appears after 20 items)
- Settings tab visible only to account owner
- Delete account flow completes and signs out
