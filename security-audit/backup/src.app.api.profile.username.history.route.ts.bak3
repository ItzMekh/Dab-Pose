import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq, and, desc, lt } from 'drizzle-orm'

const PAGE_SIZE = 20

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode')
  const cursor = searchParams.get('cursor')

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const conditions = [eq(scores.userId, user.id)]
  if (mode === 'single' || mode === 'streak') {
    conditions.push(eq(scores.mode, mode))
  }
  if (cursor) {
    conditions.push(lt(scores.createdAt, new Date(cursor)))
  }

  const items = await db
    .select({
      id: scores.id,
      mode: scores.mode,
      timeMs: scores.timeMs,
      count: scores.count,
      country: scores.country,
      rankGlobal: scores.rankGlobal,
      createdAt: scores.createdAt,
    })
    .from(scores)
    .where(and(...conditions))
    .orderBy(desc(scores.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = items.length > PAGE_SIZE
  const page = items.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? page[page.length - 1].createdAt?.toISOString() ?? null : null

  return NextResponse.json({ items: page, nextCursor })
}
