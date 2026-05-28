import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { redis, todayKey, weekKey, countryAllKey } from '@/lib/redis'

const HEADERS = {
  'Cache-Control': 'private, max-age=10',
  'X-Content-Type-Options': 'nosniff',
} as const

function parseZrangeWithScores(raw: Array<string | number>): Array<{ key: string; total: number }> {
  const out: Array<{ key: string; total: number }> = []
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ key: String(raw[i]), total: Math.round(Number(raw[i + 1])) })
  }
  return out
}

async function topN(key: string, n: number) {
  const raw = (await redis.zrange(key, 0, n - 1, { rev: true, withScores: true })) as Array<string | number>
  return parseZrangeWithScores(raw)
}

export async function GET(req: NextRequest) {
  const { admin } = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: HEADERS })
  }

  const section = req.nextUrl.searchParams.get('section')

  if (section === 'pages') {
    const topPages = await topN('lb:pv:path', 10)
    return NextResponse.json({ topPages }, { headers: HEADERS })
  }

  if (section === 'referrers') {
    const referrers = await topN('lb:pv:ref', 10)
    return NextResponse.json({ referrers }, { headers: HEADERS })
  }

  if (section === 'devices') {
    const devices = await topN('lb:pv:dev', 10)
    return NextResponse.json({ devices, browsers: [] }, { headers: HEADERS })
  }

  if (section === 'countries') {
    const [pvCountries, playCountries] = await Promise.all([
      topN('lb:pv:country', 20),
      topN(countryAllKey(), 20),
    ])
    const playMap = new Map(playCountries.map(c => [c.key, c.total]))
    const byCountry = pvCountries.map(c => ({
      key: c.key,
      visitors: c.total,
      pageviews: c.total,
      plays: playMap.get(c.key) ?? 0,
    }))
    return NextResponse.json({ byCountry }, { headers: HEADERS })
  }

  const today = todayKey()
  const week = weekKey()
  const [rawTotal, rawToday, rawWeek] = (await redis.mget(
    'lb:pv:total',
    `lb:pv:today:${today}`,
    `lb:pv:week:${week}`,
  )) as Array<string | number | null>

  return NextResponse.json({
    pageviews: rawTotal ? Number(rawTotal) : 0,
    pageviewsToday: rawToday ? Number(rawToday) : 0,
    pageviewsWeek: rawWeek ? Number(rawWeek) : 0,
    unavailable: false,
  }, { headers: HEADERS })
}
