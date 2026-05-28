import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { redis, todayKey, weekKey } from '@/lib/redis'

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' } as const

export async function GET() {
  const { admin } = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS })
  }

  const p = redis.pipeline()
  p.zcard('lb:single:all')
  p.zcard('lb:streak:all')
  p.zcard(`lb:single:today:${todayKey()}`)
  p.zcard(`lb:streak:today:${todayKey()}`)
  p.zcard(`lb:single:week:${weekKey()}`)
  p.zcard(`lb:streak:week:${weekKey()}`)

  const [sAll, stAll, sToday, stToday, sWeek, stWeek] = (await p.exec()) as number[]

  return NextResponse.json({
    single: { all: sAll, today: sToday, week: sWeek },
    streak: { all: stAll, today: stToday, week: stWeek },
  }, { headers: SECURITY_HEADERS })
}
