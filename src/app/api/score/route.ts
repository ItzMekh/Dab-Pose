import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { redis, weekKey, todayKey, countryAllKey, countryWeekKey, countryTodayKey } from '@/lib/redis'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { scores as scoresTable, users } from '@/lib/schema'

const MIN_MS = 100
const MAX_MS = 30_000
const MAX_COUNT = 300 // 30 s × 10 dabs/s — physically impossible to exceed
const USERNAME_RE = /^[a-zA-Z0-9_\- ]{1,20}$/

// TTL: week key lives 14 days, today key lives 2 days
const WEEK_TTL = 14 * 24 * 3600
const TODAY_TTL = 2 * 24 * 3600

// --- In-memory rate limiter (IP-based, max 10 POST /api/score per minute) ---
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 10
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_MAX) return true
  entry.count++
  return false
}

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' } as const

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: SECURITY_HEADERS }
    )
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: SECURITY_HEADERS })
  }

  const { username, time_ms, mode = 'single', count } = body as Record<string, unknown>

  const rawCountry = (body as Record<string, unknown>).country
  const country =
    typeof rawCountry === 'string' && /^[A-Z]{2}$/i.test(rawCountry)
      ? rawCountry.toUpperCase()
      : 'XX'

  if (mode !== 'single' && mode !== 'streak') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400, headers: SECURITY_HEADERS })
  }

  // Authenticated submissions: resolve canonical username from DB via session.user.id.
  // Anonymous: validate and use the client-provided name.
  let user: string
  if (userId) {
    const [dbUser] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401, headers: SECURITY_HEADERS })
    }
    user = dbUser.username
  } else {
    if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400, headers: SECURITY_HEADERS })
    }
    user = (username as string).trim()
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  if (mode === 'streak') {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > MAX_COUNT) {
      return NextResponse.json({ error: 'Invalid count' }, { status: 400, headers: SECURITY_HEADERS })
    }
    const bestMs =
      typeof time_ms === 'number' && Number.isInteger(time_ms) && time_ms >= MIN_MS && time_ms <= MAX_MS
        ? time_ms
        : null

    const member = JSON.stringify({ id, userId, username: user, count, time_ms: bestMs, mode: 'streak', created_at: now, country })
    const allKey = 'lb:streak:all'
    const wKey = `lb:streak:week:${weekKey()}`
    const tKey = `lb:streak:today:${todayKey()}`
    const cAllKey = countryAllKey()
    const cWKey = countryWeekKey()
    const cTKey = countryTodayKey()

    const p = redis.pipeline()
    p.zadd(allKey, { score: count, member })
    p.zadd(wKey, { score: count, member })
    p.zadd(tKey, { score: count, member })
    p.expire(wKey, WEEK_TTL)
    p.expire(tKey, TODAY_TTL)
    p.incr('lb:stats:plays')
    p.zincrby(cAllKey, 1, country)
    p.zincrby(cWKey, 1, country)
    p.zincrby(cTKey, 1, country)
    p.expire(cWKey, WEEK_TTL)
    p.expire(cTKey, TODAY_TTL)
    await p.exec()

    const [betterCount, totalCount, rank] = await Promise.all([
      redis.zcount(allKey, count + 1, '+inf'),
      redis.zcard(allKey),
      redis.zrevrank(allKey, member),
    ])

    const total = (totalCount as number) ?? 1
    const better = (betterCount as number) ?? 0
    const percentile = Math.round(((total - better) / total) * 100)
    const isKing = rank === 0

    if (userId) {
      await db.insert(scoresTable).values({
        userId,
        username: user,
        mode: 'streak',
        timeMs: bestMs,
        count: count as number,
        country,
        rankGlobal: typeof rank === 'number' ? rank + 1 : null,
      })
    }

    return NextResponse.json(
      { id, username: user, count, time_ms: bestMs, mode: 'streak', created_at: now, percentile, isKing },
      { status: 201, headers: SECURITY_HEADERS }
    )
  }

  // single mode
  if (typeof time_ms !== 'number' || !Number.isInteger(time_ms) || time_ms < MIN_MS || time_ms > MAX_MS) {
    return NextResponse.json({ error: 'Invalid time_ms' }, { status: 400, headers: SECURITY_HEADERS })
  }

  const member = JSON.stringify({ id, userId, username: user, time_ms, count: null, mode: 'single', created_at: now, country })
  const allKey = 'lb:single:all'
  const wKey = `lb:single:week:${weekKey()}`
  const tKey = `lb:single:today:${todayKey()}`
  const cAllKey = countryAllKey()
  const cWKey = countryWeekKey()
  const cTKey = countryTodayKey()

  const p = redis.pipeline()
  p.zadd(allKey, { score: time_ms, member })
  p.zadd(wKey, { score: time_ms, member })
  p.zadd(tKey, { score: time_ms, member })
  p.expire(wKey, WEEK_TTL)
  p.expire(tKey, TODAY_TTL)
  p.incr('lb:stats:plays')
  p.zincrby(cAllKey, 1, country)
  p.zincrby(cWKey, 1, country)
  p.zincrby(cTKey, 1, country)
  p.expire(cWKey, WEEK_TTL)
  p.expire(cTKey, TODAY_TTL)
  await p.exec()

  const [betterCount, totalCount, rank] = await Promise.all([
    redis.zcount(allKey, '-inf', time_ms - 1),
    redis.zcard(allKey),
    redis.zrank(allKey, member),
  ])

  const total = (totalCount as number) ?? 1
  const better = (betterCount as number) ?? 0
  const percentile = Math.round(((total - better) / total) * 100)
  const isKing = rank === 0

  if (userId) {
    await db.insert(scoresTable).values({
      userId,
      username: user,
      mode: 'single',
      timeMs: time_ms as number,
      count: null,
      country,
      rankGlobal: typeof rank === 'number' ? rank + 1 : null,
    })
  }

  return NextResponse.json(
    { id, username: user, time_ms, count: null, mode: 'single', created_at: now, percentile, isKing },
    { status: 201, headers: SECURITY_HEADERS }
  )
}
