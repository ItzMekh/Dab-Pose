import { NextRequest, NextResponse } from 'next/server'
import { redis, weekKey, todayKey } from '@/lib/redis'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'streak' ? 'streak' : 'single'
  const period = req.nextUrl.searchParams.get('period')

  let key: string
  if (period === 'week') {
    key = `lb:${mode}:week:${weekKey()}`
  } else if (period === 'today') {
    key = `lb:${mode}:today:${todayKey()}`
  } else {
    key = `lb:${mode}:all`
  }

  // single: ascending (lowest time_ms = rank #1)
  // streak: descending (highest count = rank #1)
  const raw = await redis.zrange(key, 0, 99, mode === 'streak' ? { rev: true } : {}) as string[]
  const data = raw.map(m => (typeof m === 'string' ? JSON.parse(m) : m))

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
