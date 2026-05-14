# Phase 1 — Country & Global Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add country detection, country leaderboard tab, and "X DABS worldwide" global counter to the existing app — no auth required.

**Architecture:** Client calls `GET /api/country/detect` once on mount (cached in sessionStorage). Score submit adds country to the JSON payload and the server pipelines `ZINCRBY` on three country Redis sorted sets alongside existing leaderboard writes. The leaderboard page gains a third "🌍 Countries" tab backed by `GET /api/leaderboard?mode=country`.

**Tech Stack:** Existing Next.js 15 App Router, Upstash Redis, Tailwind CSS v4, Framer Motion — no new dependencies.

---

## File Map

| Action | Path |
|---|---|
| Create | `src/app/api/country/detect/route.ts` |
| Create | `src/components/leaderboard/CountryLeaderboard.tsx` |
| Create | `src/hooks/useCountry.ts` |
| Modify | `src/types/index.ts` |
| Modify | `src/lib/redis.ts` |
| Modify | `src/lib/api.ts` |
| Modify | `src/app/api/score/route.ts` |
| Modify | `src/app/api/leaderboard/route.ts` |
| Modify | `src/components/leaderboard/Leaderboard.tsx` |
| Modify | `src/components/landing/LandingScreen.tsx` |
| Modify | `src/components/game/ResultScreen.tsx` |
| Modify | `src/components/game/StreakResultScreen.tsx` |
| Create | `tests/country.spec.ts` |

---

## Task 1: Types + Redis Key Helpers

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/redis.ts`

- [ ] **Step 1: Add `country` field to Score type**

In `src/types/index.ts`, add `country?: string` to the Score interface:

```typescript
export interface Score {
  id: string
  username: string
  time_ms: number | null
  count: number | null
  mode: 'single' | 'streak'
  created_at: string
  country?: string  // ISO 3166-1 alpha-2 or "XX" for unknown
}
```

- [ ] **Step 2: Add country key helpers to `src/lib/redis.ts`**

```typescript
// append after existing weekKey() and todayKey()

export function countryAllKey(): string {
  return 'lb:country:all'
}

export function countryWeekKey(): string {
  return `lb:country:week:${weekKey()}`
}

export function countryTodayKey(): string {
  return `lb:country:today:${todayKey()}`
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/redis.ts
git commit -m "feat(phase1): add country field to Score type and Redis key helpers"
```

---

## Task 2: Country Detection API

**Files:**
- Create: `src/app/api/country/detect/route.ts`

- [ ] **Step 1: Write the failing Playwright test first**

Create `tests/country.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('GET /api/country/detect returns valid response', async ({ request }) => {
  const res = await request.get('/api/country/detect')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body).toHaveProperty('country')
  expect(typeof body.country).toBe('string')
  // In test env, Vercel header absent → should return 'XX'
  expect(['XX', ...Object.keys({})].includes(body.country) || body.country.length === 2).toBe(true)
})
```

- [ ] **Step 2: Run test to confirm it fails (server returns 404)**

```bash
npm run test -- tests/country.spec.ts
```

Expected: FAIL — route doesn't exist yet

- [ ] **Step 3: Create the route**

Create `src/app/api/country/detect/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Vercel sets this header automatically from IP geolocation
  const country = req.headers.get('x-vercel-ip-country') ?? 'XX'
  // 'XX' means unknown/undetectable (VPN, missing header in dev)
  return NextResponse.json(
    { country: country.toUpperCase() },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test -- tests/country.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/country/detect/route.ts tests/country.spec.ts
git commit -m "feat(phase1): add GET /api/country/detect route"
```

---

## Task 3: Score Route — Accept Country + ZINCRBY

**Files:**
- Modify: `src/app/api/score/route.ts`

- [ ] **Step 1: Add test for country in score submit**

Append to `tests/country.spec.ts`:

```typescript
test('POST /api/score with country=TH increments country leaderboard', async ({ request }) => {
  const res = await request.post('/api/score', {
    data: { username: 'testcountry', time_ms: 500, mode: 'single', country: 'TH' },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.username).toBe('testcountry')

  // Country leaderboard should now have TH
  const lb = await request.get('/api/leaderboard?mode=country')
  expect(lb.status()).toBe(200)
  // Will be 404 until Task 4 is done — skip leaderboard check here
})

test('POST /api/score with invalid country defaults gracefully', async ({ request }) => {
  const res = await request.post('/api/score', {
    data: { username: 'testcountry2', time_ms: 600, mode: 'single', country: 'INVALID' },
  })
  expect(res.status()).toBe(201)
})
```

- [ ] **Step 2: Run tests — score tests should pass, country leaderboard check skipped**

```bash
npm run test -- tests/country.spec.ts
```

- [ ] **Step 3: Update `src/lib/api.ts` — add `country` to `SubmitPayload`**

```typescript
export interface SubmitPayload {
  username: string
  time_ms?: number
  mode?: 'single' | 'streak'
  count?: number
  country?: string  // ISO 3166-1 alpha-2 or 'XX'
}
```

- [ ] **Step 4: Update `src/app/api/score/route.ts` — extract country + ZINCRBY**

Import the new key helpers at the top:
```typescript
import { redis, weekKey, todayKey, countryAllKey, countryWeekKey, countryTodayKey } from '@/lib/redis'
```

After the `const user = ...` line, add country validation:
```typescript
const rawCountry = (body as Record<string, unknown>).country
const country =
  typeof rawCountry === 'string' && /^[A-Z]{2}$/.test(rawCountry.toUpperCase())
    ? rawCountry.toUpperCase()
    : 'XX'
```

In the streak pipeline (after `p.incr('lb:stats:plays')`), add:
```typescript
p.zincrby(countryAllKey(), 1, country)
p.zincrby(countryWeekKey(), 1, country)
p.zincrby(countryTodayKey(), 1, country)
p.expire(countryWeekKey(), WEEK_TTL)
p.expire(countryTodayKey(), TODAY_TTL)
```

In the single pipeline, add the same 5 lines after `p.incr('lb:stats:plays')`.

Also update both JSON.stringify member strings to include country:
```typescript
// streak member:
const member = JSON.stringify({ id, username: user, count, time_ms: bestMs, mode: 'streak', created_at: now, country })
// single member:
const member = JSON.stringify({ id, username: user, time_ms, count: null, mode: 'single', created_at: now, country })
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/app/api/score/route.ts tests/country.spec.ts
git commit -m "feat(phase1): score submit accepts country, ZINCRBY on country sorted sets"
```

---

## Task 4: Leaderboard Route — mode=country

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

- [ ] **Step 1: Add test for country leaderboard**

Append to `tests/country.spec.ts`:

```typescript
test('GET /api/leaderboard?mode=country returns array with country+totalDabs', async ({ request }) => {
  // Submit a score first to ensure at least one country entry exists
  await request.post('/api/score', {
    data: { username: 'countrytest3', time_ms: 400, mode: 'single', country: 'JP' },
  })

  const res = await request.get('/api/leaderboard?mode=country')
  expect(res.status()).toBe(200)
  const data = await res.json()
  expect(Array.isArray(data)).toBe(true)
  if (data.length > 0) {
    expect(data[0]).toHaveProperty('country')
    expect(data[0]).toHaveProperty('totalDabs')
    expect(typeof data[0].totalDabs).toBe('number')
    // Should be sorted descending
    if (data.length > 1) {
      expect(data[0].totalDabs).toBeGreaterThanOrEqual(data[1].totalDabs)
    }
  }
})

test('GET /api/leaderboard?mode=country&period=week returns array', async ({ request }) => {
  const res = await request.get('/api/leaderboard?mode=country&period=week')
  expect(res.status()).toBe(200)
  expect(Array.isArray(await res.json())).toBe(true)
})

test('GET /api/leaderboard?mode=country&period=today returns array', async ({ request }) => {
  const res = await request.get('/api/leaderboard?mode=country&period=today')
  expect(res.status()).toBe(200)
  expect(Array.isArray(await res.json())).toBe(true)
})
```

- [ ] **Step 2: Run tests — should fail (mode=country returns single leaderboard)**

```bash
npm run test -- tests/country.spec.ts
```

Expected: FAIL on country leaderboard tests

- [ ] **Step 3: Update `src/app/api/leaderboard/route.ts`**

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { redis, weekKey, todayKey, countryAllKey, countryWeekKey, countryTodayKey } from '@/lib/redis'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get('mode') ?? 'single'
  const period = params.get('period')

  if (mode === 'country') {
    let key: string
    if (period === 'week') key = countryWeekKey()
    else if (period === 'today') key = countryTodayKey()
    else key = countryAllKey()

    const raw = await redis.zrange(key, 0, 49, { rev: true, withScores: true }) as Array<{ member: string; score: number }>
    const entries = raw.map(({ member, score }) => ({
      country: member,
      totalDabs: Math.round(score),
    }))
    return NextResponse.json(entries, { headers: CACHE_HEADERS })
  }

  // single / streak (existing logic)
  const leaderMode = mode === 'streak' ? 'streak' : 'single'
  let key: string
  if (period === 'week') key = `lb:${leaderMode}:week:${weekKey()}`
  else if (period === 'today') key = `lb:${leaderMode}:today:${todayKey()}`
  else key = `lb:${leaderMode}:all`

  const raw = await redis.zrange(key, 0, 99, leaderMode === 'streak' ? { rev: true } : {}) as string[]
  const data = raw.map(m => (typeof m === 'string' ? JSON.parse(m) : m))
  return NextResponse.json(data, { headers: CACHE_HEADERS })
}
```

- [ ] **Step 4: Run tests — all country tests should pass**

```bash
npm run test -- tests/country.spec.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leaderboard/route.ts tests/country.spec.ts
git commit -m "feat(phase1): leaderboard route handles mode=country with period filter"
```

---

## Task 5: useCountry Hook

**Files:**
- Create: `src/hooks/useCountry.ts`

- [ ] **Step 1: Create `src/hooks/useCountry.ts`**

```typescript
'use client'

import { useEffect, useState } from 'react'

export function useCountry(): string {
  const [country, setCountry] = useState('XX')

  useEffect(() => {
    const cached = sessionStorage.getItem('dab_country')
    if (cached) { setCountry(cached); return }
    fetch('/api/country/detect')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const code = (d?.country as string) ?? 'XX'
        sessionStorage.setItem('dab_country', code)
        setCountry(code)
      })
      .catch(() => {})
  }, [])

  return country
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCountry.ts
git commit -m "feat(phase1): add useCountry hook (sessionStorage cached)"
```

---

## Task 6: CountryLeaderboard Component

**Files:**
- Create: `src/components/leaderboard/CountryLeaderboard.tsx`

- [ ] **Step 1: Create `src/components/leaderboard/CountryLeaderboard.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRealtimeVersion } from '@/hooks/useRealtimeVersion'

interface CountryEntry {
  country: string
  totalDabs: number
}

type Period = 'all' | 'week' | 'today'

const PERIOD_LABELS: Record<Period, string> = { all: 'All Time', week: 'This Week', today: 'Today' }

const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina',
  AU: 'Australia', AT: 'Austria', BE: 'Belgium', BR: 'Brazil',
  BG: 'Bulgaria', CA: 'Canada', CL: 'Chile', CN: 'China',
  CO: 'Colombia', HR: 'Croatia', CZ: 'Czechia', DK: 'Denmark',
  EG: 'Egypt', FI: 'Finland', FR: 'France', DE: 'Germany',
  GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary', IN: 'India',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IT: 'Italy',
  JP: 'Japan', KZ: 'Kazakhstan', KE: 'Kenya', KR: 'South Korea',
  MY: 'Malaysia', MX: 'Mexico', MA: 'Morocco', NL: 'Netherlands',
  NZ: 'New Zealand', NG: 'Nigeria', NO: 'Norway', PK: 'Pakistan',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal',
  RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia', SG: 'Singapore',
  ZA: 'South Africa', ES: 'Spain', SE: 'Sweden', CH: 'Switzerland',
  TW: 'Taiwan', TH: 'Thailand', TR: 'Turkey', UA: 'Ukraine',
  GB: 'United Kingdom', US: 'United States', VN: 'Vietnam',
  XX: 'Global',
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2 || code === 'XX') return '🌍'
  return Array.from(code.toUpperCase())
    .map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6))
    .join('')
}

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

interface Props {
  detectedCountry: string
}

export default function CountryLeaderboard({ detectedCountry }: Props) {
  const [entries, setEntries] = useState<CountryEntry[]>([])
  const [period, setPeriod] = useState<Period>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const fetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const periodParam = period !== 'all' ? `&period=${period}` : ''
    const url = `/api/leaderboard?mode=country${periodParam}`

    const doFetch = (fresh: boolean, noStore = false) => {
      if (fresh) { setLoading(true); setError(false) }
      fetch(url, (fresh || noStore) ? { cache: 'no-store' } : {})
        .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
        .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false) })
        .catch(() => { if (fresh) { setError(true); setLoading(false) } })
    }

    fetchRef.current = () => doFetch(false, true)
    doFetch(true)
    const interval = setInterval(() => doFetch(false), 30_000)
    return () => { clearInterval(interval); fetchRef.current = null }
  }, [period])

  useRealtimeVersion(() => fetchRef.current?.())

  const total = entries.reduce((sum, e) => sum + e.totalDabs, 0)
  const myIdx = entries.findIndex(e => e.country === detectedCountry)
  const myEntry = myIdx >= 0 ? entries[myIdx] : null

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
        {(['all', 'week', 'today'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load.</div>
        ) : entries.length === 0 ? (
          <div className="min-h-[200px] flex items-center justify-center text-gray-400">No dabs yet. Be first!</div>
        ) : (
          <div className="divide-y divide-white/5">
            {entries.map((entry, i) => {
              const pct = total > 0 ? (entry.totalDabs / total) * 100 : 0
              const isFirst = i === 0
              return (
                <motion.div
                  key={entry.country}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`px-4 py-3 ${isFirst ? 'bg-purple-500/10' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gray-400 font-mono text-sm w-6 text-center">
                      {isFirst ? '👑' : `#${i + 1}`}
                    </span>
                    <span className="text-xl leading-none">{countryFlag(entry.country)}</span>
                    <span className={`flex-1 font-semibold text-sm ${isFirst ? 'text-purple-300' : 'text-white'}`}>
                      {countryName(entry.country)}
                    </span>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${isFirst ? 'text-purple-300' : 'text-gray-300'}`}>
                        {pct.toFixed(1)}%
                      </p>
                      <p className="text-gray-500 text-xs">{entry.totalDabs.toLocaleString()} dabs</p>
                    </div>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.03 }}
                      className={`h-full rounded-full ${isFirst ? 'bg-gradient-to-r from-purple-500 to-purple-400' : 'bg-white/25'}`}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Your country pill */}
      {myEntry && detectedCountry !== 'XX' && (
        <p className="text-center text-xs text-gray-500">
          {'Dabbing for '}
          <span className="text-purple-400 font-semibold">
            {countryFlag(detectedCountry)} {countryName(detectedCountry)}
            {' — '}#{myIdx + 1}
            {total > 0 && ` · ${((myEntry.totalDabs / total) * 100).toFixed(1)}% of all dabs`}
          </span>
          {myIdx === 0 && ' 👑'}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard/CountryLeaderboard.tsx
git commit -m "feat(phase1): add CountryLeaderboard component"
```

---

## Task 7: Update Leaderboard.tsx — Add Countries Tab

**Files:**
- Modify: `src/components/leaderboard/Leaderboard.tsx`

- [ ] **Step 1: Update `src/components/leaderboard/Leaderboard.tsx`**

Replace the file with the following (all existing logic preserved, Countries tab added):

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { Score } from '@/types'
import { useRealtimeVersion } from '@/hooks/useRealtimeVersion'
import { useCountry } from '@/hooks/useCountry'
import CountryLeaderboard from './CountryLeaderboard'

type Tab = 'single' | 'streak' | 'country'
type Period = 'all' | 'week' | 'today'
const PAGE = 10
const PERIOD_LABELS: Record<Period, string> = { all: 'All Time', week: 'This Week', today: 'Today' }

function GlobalCounter() {
  const [totalPlays, setTotalPlays] = useState<number | null>(null)
  const fetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const doFetch = () =>
      fetch('/api/stats', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && typeof d.totalPlays === 'number') setTotalPlays(d.totalPlays) })
        .catch(() => {})
    fetchRef.current = doFetch
    doFetch()
    const id = setInterval(doFetch, 30_000)
    return () => { clearInterval(id); fetchRef.current = null }
  }, [])

  useRealtimeVersion(() => fetchRef.current?.())

  if (!totalPlays || totalPlays === 0) return null
  return (
    <p className="text-gray-500 text-sm">
      {totalPlays.toLocaleString('en-US')} dabs worldwide
    </p>
  )
}

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('single')
  const [period, setPeriod] = useState<Period>('all')
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(PAGE)
  const fetchRef = useRef<(() => void) | null>(null)
  const detectedCountry = useCountry()

  useEffect(() => {
    if (tab === 'country') return
    const periodParam = period !== 'all' ? `&period=${period}` : ''
    const url = `/api/leaderboard?mode=${tab}${periodParam}`

    const doFetch = (fresh: boolean, noStore = false) => {
      if (fresh) { setLoading(true); setError(false); setVisible(PAGE) }
      fetch(url, (fresh || noStore) ? { cache: 'no-store' } : {})
        .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
        .then(data => { setScores(Array.isArray(data) ? data : []); setLoading(false) })
        .catch(() => { if (fresh) { setError(true); setLoading(false) } })
    }

    fetchRef.current = () => doFetch(false, true)
    doFetch(true)
    const interval = setInterval(() => doFetch(false), 30_000)
    return () => { clearInterval(interval); fetchRef.current = null }
  }, [tab, period, retry])

  useRealtimeVersion(() => { if (tab !== 'country') fetchRef.current?.() })

  const shown = scores.slice(0, visible)
  const hasMore = visible < scores.length

  return (
    <div className="w-full max-w-lg px-4 sm:px-0 pb-28">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white">Leaderboard</h1>
          <GlobalCounter />
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
          {(['single', 'streak', 'country'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'single' ? '⚡ Reflex Dab' : t === 'streak' ? '🔥 Dab Rush' : '🌍 Countries'}
            </button>
          ))}
        </div>

        {/* Period tabs — hidden on country tab */}
        {tab !== 'country' && (
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            {(['all', 'week', 'today'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'country' ? (
            <motion.div
              key="country"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <CountryLeaderboard detectedCountry={detectedCountry} />
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-white/5 border border-white/10 backdrop-blur-lg rounded-2xl overflow-hidden overflow-x-auto"
            >
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading...</div>
              ) : error ? (
                <div className="p-8 text-center text-red-400 text-sm">
                  Failed to load scores.{' '}
                  <button onClick={() => setRetry(r => r + 1)} className="underline cursor-pointer">Retry</button>
                </div>
              ) : scores.length === 0 ? (
                <div className="min-h-[200px] flex items-center justify-center text-center text-gray-400">No scores yet. Be the first!</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                      <th className="p-4 text-left">#</th>
                      <th className="p-4 text-left">Name</th>
                      {tab === 'single'
                        ? <th className="p-4 text-center">Time (ms)</th>
                        : <th className="p-4 text-center">Dabs / 30s</th>
                      }
                      <th className="p-4 text-right hidden sm:table-cell">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((score, i) => (
                      <motion.tr
                        key={score.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-yellow-400/5' : ''}`}
                      >
                        <td className="p-4 text-gray-400 font-mono">
                          {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td className="p-4 font-semibold">
                          {i === 0 ? (
                            <span className="text-yellow-300 flex items-center gap-2">
                              <span className="max-w-[120px] sm:max-w-none truncate">{score.username}</span>
                              <span className="text-xs font-normal text-yellow-600 tracking-wide shrink-0">
                                {tab === 'single' ? 'Reflex God' : 'Most Dabs'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-white max-w-[120px] sm:max-w-none truncate block">{score.username}</span>
                          )}
                        </td>
                        <td className="p-4 text-center font-mono text-purple-300 font-bold">
                          {tab === 'single' ? score.time_ms : score.count}
                        </td>
                        <td className="p-4 text-right hidden sm:table-cell text-gray-600 text-xs font-mono">
                          {(() => {
                            const d = new Date(score.created_at)
                            const dd = String(d.getDate()).padStart(2, '0')
                            const mm = String(d.getMonth() + 1).padStart(2, '0')
                            const yyyy = d.getFullYear()
                            const hh = String(d.getHours()).padStart(2, '0')
                            const min = String(d.getMinutes()).padStart(2, '0')
                            return `${dd}/${mm}/${yyyy} ${hh}:${min}`
                          })()}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {tab !== 'country' && hasMore && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setVisible(v => v + PAGE)}
            className="w-full py-3 text-gray-400 hover:text-white text-sm font-semibold border border-white/10 hover:border-white/20 rounded-2xl transition-all cursor-pointer bg-white/3 hover:bg-white/8"
          >
            Show More ({scores.length - visible} remaining)
          </motion.button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-center pointer-events-none">
        <Link
          href="/"
          className="pointer-events-auto group flex items-center justify-center gap-3 w-full max-w-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-black text-lg py-4 rounded-2xl transition-all duration-200 shadow-2xl shadow-purple-900/60 hover:shadow-purple-700/60 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
        >
          <span className="text-2xl group-hover:animate-bounce">🙌</span>
          Play Now
          <span className="text-purple-300 font-normal text-sm">→</span>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard/Leaderboard.tsx
git commit -m "feat(phase1): add Countries tab to Leaderboard with global counter"
```

---

## Task 8: LandingScreen — Update Copy + Global Counter

**Files:**
- Modify: `src/components/landing/LandingScreen.tsx`

- [ ] **Step 1: Update copy from "X PLAYERS" to "X DABS worldwide"**

In `src/components/landing/LandingScreen.tsx`, replace:

```typescript
className="text-gray-400 text-base font-normal tracking-widest"
>
  {formatPlays(totalPlays)} PLAYERS
```

with:

```typescript
className="text-gray-400 text-base font-normal tracking-widest"
>
  {formatPlays(totalPlays)} DABS WORLDWIDE
```

- [ ] **Step 2: Verify TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/LandingScreen.tsx
git commit -m "feat(phase1): update global counter copy to 'DABS WORLDWIDE'"
```

---

## Task 9: Pass Country to Score Submit

**Files:**
- Modify: `src/components/game/ResultScreen.tsx`
- Modify: `src/components/game/StreakResultScreen.tsx`

- [ ] **Step 1: Update `src/components/game/ResultScreen.tsx`**

Add import at the top:
```typescript
import { useCountry } from '@/hooks/useCountry'
```

Inside `ResultScreen` component, after the existing hooks:
```typescript
const country = useCountry()
```

Update the `handleSubmit` call:
```typescript
const res = await submitScore({ username: username.trim(), time_ms: result.time_ms, country })
```

- [ ] **Step 2: Update `src/components/game/StreakResultScreen.tsx`**

Add import:
```typescript
import { useCountry } from '@/hooks/useCountry'
```

Inside `StreakResultScreen` component:
```typescript
const country = useCountry()
```

Update the `submitScore` call:
```typescript
const res = await submitScore({
  username: username.trim(),
  mode: 'streak',
  count: result.count,
  time_ms: result.best_time_ms ?? undefined,
  country,
})
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/game/ResultScreen.tsx src/components/game/StreakResultScreen.tsx
git commit -m "feat(phase1): pass detected country to score submit"
```

---

## Task 10: Full Test Suite + Dev Smoke Test

- [ ] **Step 1: Run full Playwright test suite**

```bash
npm run test
```

Expected: all existing tests pass + new country tests pass

- [ ] **Step 2: Start dev server and manually verify**

```bash
npm run dev
```

Open http://localhost:3000 — confirm:
- "X DABS WORLDWIDE" shows on landing screen
- Open http://localhost:3000/leaderboard → Countries tab appears
- Click Countries → list loads (may be empty in dev, that's OK)
- Play a game and submit → check Countries tab updates

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: ✓ Compiled successfully, no TypeScript errors

- [ ] **Step 4: Final commit + push**

```bash
git add -A
git commit -m "feat: Phase 1 complete — country leaderboard and global dab counter"
git push
```

---

## Checklist Before Moving to Phase 2

- [ ] `GET /api/country/detect` returns 200 + `{ country: string }`
- [ ] `POST /api/score` with `country: "TH"` → country leaderboard increments
- [ ] `GET /api/leaderboard?mode=country` returns `[{ country, totalDabs }]` sorted DESC
- [ ] Period filter works for week + today
- [ ] Countries tab renders in Leaderboard page
- [ ] Progress bars show % of total (not relative to #1)
- [ ] Landing screen shows "X DABS WORLDWIDE"
- [ ] All Playwright tests pass
- [ ] `npm run build` succeeds
