import { type NextRequest, NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
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
    await db.update(users).set({ username: value }).where(eq(users.id, session.user.id))
    return NextResponse.json({ ok: true, username: value })
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

  await db.delete(users).where(eq(users.id, session.user.id))
  return NextResponse.json({ ok: true })
}
