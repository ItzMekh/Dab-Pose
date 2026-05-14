import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function suggestUsernames(base: string, country: string): string[] {
  const b = base.slice(0, 17)
  const c = country === 'XX' ? 'user' : country.toLowerCase()
  return [
    `${b}${Math.floor(Math.random() * 90 + 10)}`,
    `${b}_${c}`,
    `${b}${Math.floor(Math.random() * 900 + 100)}`,
  ]
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, email, password, country = 'XX' } = body as Record<string, unknown>

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–20 chars, letters/numbers/underscore only' },
      { status: 400 }
    )
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existingEmail) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const [existingUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  if (existingUsername) {
    const suggestions = suggestUsernames(username, country as string)
    return NextResponse.json({ error: 'Username taken', suggestions }, { status: 409 })
  }

  const passwordHash = await hash(password, 12)
  const countryCode = typeof country === 'string'
    ? country.toUpperCase().slice(0, 2)
    : 'XX'

  const [user] = await db
    .insert(users)
    .values({ email, username, passwordHash, country: countryCode })
    .returning({ id: users.id, username: users.username })

  return NextResponse.json({ id: user.id, username: user.username }, { status: 201 })
}
