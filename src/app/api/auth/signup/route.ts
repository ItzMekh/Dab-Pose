import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { signupLimiter, clientIpOrFail } from '@/lib/ratelimit'
import { isSameOrigin } from '@/lib/csrf'

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
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let ip: string
  try {
    ip = clientIpOrFail(req)
  } catch {
    return NextResponse.json({ error: 'Client IP missing' }, { status: 400 })
  }

  try {
    const rl = await signupLimiter.limit(ip)
    if (!rl.success) {
      const retryAfter = Math.max(1, Math.min(3600, Math.ceil((rl.reset - Date.now()) / 1000)))
      return NextResponse.json(
        { error: 'Too many signup attempts' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  } catch (e) {
    // Fail closed for credential-creation endpoints — better to 503 than to
    // open the bcrypt CPU DoS surface during a Redis outage.
    console.error('[/api/auth/signup] ratelimit error:', e)
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    )
  }

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
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1)
  if (existingEmail) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const [existingUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1)
  if (existingUsername) {
    const suggestions = suggestUsernames(username, country as string)
    return NextResponse.json({ error: 'Username taken', suggestions }, { status: 409 })
  }

  const passwordHash = await hash(password, 12)
  const countryCode = typeof country === 'string'
    ? country.toUpperCase().slice(0, 2)
    : 'XX'

  let user: { id: string; username: string }
  try {
    const [created] = await db
      .insert(users)
      .values({ email, username, passwordHash, country: countryCode })
      .returning({ id: users.id, username: users.username })
    user = created
  } catch (err: unknown) {
    // Pre-check filters soft-deleted rows (isNull(deletedAt)) so the user is
    // told "available" — but the DB-level UNIQUE constraint counts every row,
    // including soft-deleted ones. Translate that race / collision into 409.
    //
    // Drizzle wraps the underlying NeonDbError; the Postgres SQLSTATE lives on
    // `err.cause.code`. Check both shapes so a future driver change is robust.
    const e = err as { code?: string; cause?: { code?: string; constraint?: string } } | null
    const code = e?.code ?? e?.cause?.code
    const constraint = e?.cause?.constraint
    if (code === '23505') {
      const which = constraint?.includes('email') ? 'Email' : constraint?.includes('username') ? 'Username' : 'Username or email'
      return NextResponse.json(
        { error: `${which} no longer available — try a different value` },
        { status: 409 }
      )
    }
    console.error('[/api/auth/signup] insert failed:', err)
    throw err
  }

  return NextResponse.json({ id: user.id, username: user.username }, { status: 201 })
}
