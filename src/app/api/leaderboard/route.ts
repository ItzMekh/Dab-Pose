import { NextRequest, NextResponse } from 'next/server'
import { redis, weekKey, todayKey, countryAllKey, countryWeekKey, countryTodayKey } from '@/lib/redis'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get('mode') ?? 'single'
  const period = params.get('period')

  if (mode === 'country') {
    let key: string
    if (period === 'week') key = countryWeekKey()
    else if (period === 'today') key = countryTodayKey()
    else key = countryAllKey()

    // withScores returns a flat [member, score, member, score, ...] array;
    // with automaticDeserialization: false both come back as strings.
    const raw = await redis.zrange(key, 0, 49, { rev: true, withScores: true }) as Array<string | number>
    const entries: Array<{ country: string; totalDabs: number }> = []
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({
        country: String(raw[i]),
        totalDabs: Math.round(Number(raw[i + 1])),
      })
    }
    return NextResponse.json(entries, { headers: CACHE_HEADERS })
  }

  // single / streak (existing logic)
  const leaderMode = mode === 'streak' ? 'streak' : 'single'
  let key: string
  if (period === 'week') key = `lb:${leaderMode}:week:${weekKey()}`
  else if (period === 'today') key = `lb:${leaderMode}:today:${todayKey()}`
  else key = `lb:${leaderMode}:all`

  // single: ascending (lowest time_ms = rank #1)
  // streak: descending (highest count = rank #1)
  const raw = await redis.zrange(key, 0, 99, leaderMode === 'streak' ? { rev: true } : {}) as string[]
  const data = raw.map(m => (typeof m === 'string' ? JSON.parse(m) : m))
  return NextResponse.json(data, { headers: CACHE_HEADERS })
}
