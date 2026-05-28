import { NextRequest, NextResponse } from 'next/server'
import { sql, and, gte, lte, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { scores, users } from '@/lib/schema'

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' } as const
const MAX_RANGE_DAYS = 90

const QueryParams = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(req: NextRequest) {
  const { admin } = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS })
  }

  const parsed = QueryParams.safeParse({
    from: req.nextUrl.searchParams.get('from'),
    to: req.nextUrl.searchParams.get('to'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid date range (YYYY-MM-DD)' }, { status: 400, headers: SECURITY_HEADERS })
  }

  const { from, to } = parsed.data
  const fromDate = new Date(from)
  const toDate = new Date(to + 'T23:59:59.999Z')
  const diffDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000
  if (diffDays > MAX_RANGE_DAYS || diffDays < 0) {
    return NextResponse.json({ error: `Range must be 0-${MAX_RANGE_DAYS} days` }, { status: 400, headers: SECURITY_HEADERS })
  }

  const dateRange = and(gte(scores.createdAt, fromDate), lte(scores.createdAt, toDate))
  const userDateRange = and(gte(users.createdAt, fromDate), lte(users.createdAt, toDate), isNull(users.deletedAt))

  const [playsPerDay, signupsPerDay, reactionRows, totalsRow, newUsersRow] = await Promise.all([
    db
      .select({
        date: sql<string>`date(scores.created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(scores)
      .where(dateRange)
      .groupBy(sql`date(scores.created_at)`)
      .orderBy(sql`date(scores.created_at)`),

    db
      .select({
        date: sql<string>`date(users.created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(userDateRange)
      .groupBy(sql`date(users.created_at)`)
      .orderBy(sql`date(users.created_at)`),

    db
      .select({ timeMs: scores.timeMs })
      .from(scores)
      .where(and(dateRange, eq(scores.mode, 'single')))
      .limit(5000),

    db
      .select({ count: sql<number>`count(*)` })
      .from(scores)
      .where(dateRange),

    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(userDateRange),
  ])

  const totalPlays = Number(totalsRow[0]?.count) || 0
  const newUsers = Number(newUsersRow[0]?.count) || 0
  const reactionTimes = reactionRows
    .map(r => r.timeMs)
    .filter((t): t is number => t != null)

  return NextResponse.json({
    from, to,
    playsPerDay: playsPerDay.map(r => ({ date: String(r.date), count: Number(r.count) })),
    signupsPerDay: signupsPerDay.map(r => ({ date: String(r.date), count: Number(r.count) })),
    reactionTimes,
    totalPlays,
    newUsers,
    avgPlaysPerUser: newUsers > 0 ? Math.round((totalPlays / newUsers) * 10) / 10 : 0,
  }, { headers: SECURITY_HEADERS })
}
