import { NextRequest, NextResponse } from 'next/server'
import { redis, weekKey, todayKey } from '@/lib/redis'

const MIN_MS = 100
const MAX_MS = 30_000
const USERNAME_RE = /^[a-zA-Z0-9_\- ]{1,20}$/

// TTL: week key lives 14 days, today key lives 2 days
const WEEK_TTL = 14 * 24 * 3600
const TODAY_TTL = 2 * 24 * 3600

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, time_ms, mode = 'single', count } = body as Record<string, unknown>

  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
  }
  if (mode !== 'single' && mode !== 'streak') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const user = (username as string).trim()

  if (mode === 'streak') {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      return NextResponse.json({ error: 'Invalid count' }, { status: 400 })
    }
    const bestMs =
      typeof time_ms === 'number' && Number.isInteger(time_ms) && time_ms >= MIN_MS && time_ms <= MAX_MS
        ? time_ms
        : null

    const member = JSON.stringify({ id, username: user, count, time_ms: bestMs, mode: 'streak', created_at: now })
    const allKey = 'lb:streak:all'
    const wKey = `lb:streak:week:${weekKey()}`
    const tKey = `lb:streak:today:${todayKey()}`

    const p = redis.pipeline()
    p.zadd(allKey, { score: count, member })
    p.zadd(wKey, { score: count, member })
    p.zadd(tKey, { score: count, member })
    p.expire(wKey, WEEK_TTL)
    p.expire(tKey, TODAY_TTL)
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

    return NextResponse.json(
      { id, username: user, count, time_ms: bestMs, mode: 'streak', created_at: now, percentile, isKing },
      { status: 201 }
    )
  }

  // single mode
  if (typeof time_ms !== 'number' || !Number.isInteger(time_ms) || time_ms < MIN_MS || time_ms > MAX_MS) {
    return NextResponse.json({ error: 'Invalid time_ms' }, { status: 400 })
  }

  const member = JSON.stringify({ id, username: user, time_ms, count: null, mode: 'single', created_at: now })
  const allKey = 'lb:single:all'
  const wKey = `lb:single:week:${weekKey()}`
  const tKey = `lb:single:today:${todayKey()}`

  const p = redis.pipeline()
  p.zadd(allKey, { score: time_ms, member })
  p.zadd(wKey, { score: time_ms, member })
  p.zadd(tKey, { score: time_ms, member })
  p.expire(wKey, WEEK_TTL)
  p.expire(tKey, TODAY_TTL)
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

  return NextResponse.json(
    { id, username: user, time_ms, count: null, mode: 'single', created_at: now, percentile, isKing },
    { status: 201 }
  )
}
