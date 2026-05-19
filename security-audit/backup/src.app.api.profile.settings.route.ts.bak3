import { type NextRequest, NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { rewriteLeaderboardUsername } from '@/lib/rename-leaderboard'
import { settingsLimiter, passwordChangeLimiter } from '@/lib/ratelimit'
import { isSameOrigin } from '@/lib/csrf'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const COUNTRY_RE = /^[A-Z]{2}$/
const RENAME_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 1 day

function suggestUsernames(base: string): string[] {
  const b = base.slice(0, 17)
  return [
    `${b}${Math.floor(Math.random() * 90 + 10)}`,
    `${b}_alt`,
    `${b}${Math.floor(Math.random() * 900 + 100)}`,
  ]
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rl = await settingsLimiter.limit(session.user.id)
    if (!rl.success) {
      const retryAfter = Math.max(1, Math.min(3600, Math.ceil((rl.reset - Date.now()) / 1000)))
      return NextResponse.json(
        { error: 'Too many profile edits' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (e) {
    // Fail open for general settings — anti-spam, not a credential boundary.
    console.error('[/api/profile/settings] settingsLimiter error:', e)
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
    try {
      const pwRl = await passwordChangeLimiter.limit(session.user.id)
      if (!pwRl.success) {
        const retryAfter = Math.max(1, Math.min(3600, Math.ceil((pwRl.reset - Date.now()) / 1000)))
        return NextResponse.json(
          { error: 'Too many password change attempts' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (e) {
      // Fail closed — password change uses bcrypt.compare (expensive). Don't
      // open that surface during a Redis outage.
      console.error('[/api/profile/settings] passwordChangeLimiter error:', e)
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }
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

export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Just delete the user row. The scores.user_id FK is ON DELETE SET NULL, so
  // each score row keeps its username + score + country but loses its owner
  // pointer. Redis leaderboard members are left untouched, so the leaderboard
  // continues to show the original username after the account is gone.
  await db.delete(users).where(eq(users.id, session.user.id))
  return NextResponse.json({ ok: true })
}
