import { type NextRequest, NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { rewriteLeaderboardUsername } from '@/lib/rename-leaderboard'
import { redis, weekKey, todayKey } from '@/lib/redis'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const COUNTRY_RE = /^[A-Z]{2}$/
const RENAME_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 1 day
const DELETED_USERNAME = '[deleted]'

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

    const [me] = await db
      .select({ username: users.username, usernameChangedAt: users.usernameChangedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    if (!me) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // No-op rename: same as current username — accept silently
    if (me.username === value) {
      return NextResponse.json({ ok: true, username: value, noop: true })
    }

    // Rate limit: 1 rename per 24h after the first change
    if (me.usernameChangedAt) {
      const elapsed = Date.now() - me.usernameChangedAt.getTime()
      if (elapsed < RENAME_COOLDOWN_MS) {
        const nextChangeAt = new Date(me.usernameChangedAt.getTime() + RENAME_COOLDOWN_MS).toISOString()
        const retryAfterSec = Math.ceil((RENAME_COOLDOWN_MS - elapsed) / 1000)
        return NextResponse.json(
          { error: 'Username can be changed once per day', nextChangeAt, retryAfterSec },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
        )
      }
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

    // 1) Update DB users + scores
    await db
      .update(users)
      .set({ username: value, usernameChangedAt: new Date() })
      .where(eq(users.id, session.user.id))
    await db
      .update(scores)
      .set({ username: value })
      .where(eq(scores.userId, session.user.id))

    // 2) Rewrite Redis leaderboard member snapshots (best-effort — DB is source of truth)
    let leaderboard = { scanned: 0, rewritten: 0 }
    try {
      leaderboard = await rewriteLeaderboardUsername(session.user.id, me.username, value)
    } catch (err) {
      console.error('[settings] leaderboard rewrite failed:', err)
    }

    return NextResponse.json({ ok: true, username: value, leaderboard })
  }

  if (field === 'country') {
    if (typeof value !== 'string' || !COUNTRY_RE.test(value)) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
    }
    await db.update(users).set({ country: value }).where(eq(users.id, session.user.id))
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
      return NextResponse.json(
        { error: 'Password change not available for Google accounts' },
        { status: 400 }
      )
    }
    const valid = await compare(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    const passwordHash = await hash(value, 12)
    await db.update(users).set({ passwordHash }).where(eq(users.id, session.user.id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // 1. Anonymize the username on every score row owned by this user. The FK on
  //    scores.user_id is ON DELETE SET NULL, so the userId column nulls out
  //    automatically when we delete the user below.
  await db.update(scores).set({ username: DELETED_USERNAME }).where(eq(scores.userId, userId))

  // 2. Rewrite each Redis leaderboard member that points at this userId so the
  //    entry stays on the leaderboard with the same score / country / id but
  //    appears as the anonymous "[deleted]" user.
  const lbKeys = [
    'lb:single:all',
    `lb:single:week:${weekKey()}`,
    `lb:single:today:${todayKey()}`,
    'lb:streak:all',
    `lb:streak:week:${weekKey()}`,
    `lb:streak:today:${todayKey()}`,
  ]
  type Member = { id?: string; userId?: string | null; username?: string; mode?: string; time_ms?: number; count?: number }
  let rewritten = 0
  for (const key of lbKeys) {
    const members = (await redis.zrange(key, 0, -1)) as string[]
    for (const m of members) {
      let parsed: Member | null = null
      try { parsed = JSON.parse(m) } catch { continue }
      if (parsed?.userId !== userId) continue
      const score = parsed.mode === 'streak' ? Number(parsed.count ?? 0) : Number(parsed.time_ms ?? 0)
      const newMember = JSON.stringify({ ...parsed, userId: null, username: DELETED_USERNAME })
      await redis.zrem(key, m)
      await redis.zadd(key, { score, member: newMember })
      rewritten++
    }
  }

  // 3. Delete the user row last — FK cascade sets scores.user_id NULL.
  await db.delete(users).where(eq(users.id, userId))
  return NextResponse.json({ ok: true, leaderboard: { rewritten } })
}
