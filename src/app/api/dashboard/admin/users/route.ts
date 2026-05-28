import { NextRequest, NextResponse } from 'next/server'
import { sql, desc, isNull } from 'drizzle-orm'
import { isAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' } as const
const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const { admin } = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS })
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const baseWhere = isNull(users.deletedAt)

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(baseWhere)

  const total = Number(countResult.count)

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      country: users.country,
      googleId: users.googleId,
      createdAt: users.createdAt,
      plays: sql<number>`coalesce((select count(*) from scores where scores.user_id = users.id), 0)`,
      bestSingle: sql<number | null>`(select min(scores.time_ms) from scores where scores.user_id = users.id and scores.mode = 'single')`,
      bestStreak: sql<number | null>`(select max(scores.count) from scores where scores.user_id = users.id and scores.mode = 'streak')`,
    })
    .from(users)
    .where(baseWhere)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  const data = rows.map(r => ({
    id: r.id,
    username: r.username,
    country: r.country,
    authType: r.googleId ? 'google' as const : 'email' as const,
    plays: Number(r.plays),
    bestSingle: r.bestSingle != null ? Number(r.bestSingle) : null,
    bestStreak: r.bestStreak != null ? Number(r.bestStreak) : null,
    createdAt: r.createdAt?.toISOString() ?? null,
  }))

  return NextResponse.json({ total, users: data, page, pageSize: PAGE_SIZE }, { headers: SECURITY_HEADERS })
}
