import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, scores } from '@/lib/schema'
import { eq, min, max, count } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      country: users.country,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const [stats] = await db
    .select({
      bestTime: min(scores.timeMs),
      bestStreak: max(scores.count),
      totalPlays: count(),
    })
    .from(scores)
    .where(eq(scores.userId, user.id))

  return NextResponse.json(
    { user, stats: stats ?? { bestTime: null, bestStreak: null, totalPlays: 0 } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
