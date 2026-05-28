import { redis, weekKey, todayKey, countryAllKey, countryWeekKey, countryTodayKey } from '@/lib/redis'

export type Period = 'today' | 'week' | 'all'

export interface DashboardData {
  plays: number
  dabs: number
  playersToday: number
  avgReaction: number | null
  modeSplit: { single: number; streak: number }
  topCountries: Array<{ country: string; count: number }>
  topSingle: Array<{ username: string; time_ms: number }>
  topStreak: Array<{ username: string; count: number }>
  period: Period
}

function singleKey(period: Period): string {
  if (period === 'today') return `lb:single:today:${todayKey()}`
  if (period === 'week') return `lb:single:week:${weekKey()}`
  return 'lb:single:all'
}

function streakKey(period: Period): string {
  if (period === 'today') return `lb:streak:today:${todayKey()}`
  if (period === 'week') return `lb:streak:week:${weekKey()}`
  return 'lb:streak:all'
}

function countryKey(period: Period): string {
  if (period === 'today') return countryTodayKey()
  if (period === 'week') return countryWeekKey()
  return countryAllKey()
}

export async function fetchDashboardData(period: Period = 'all'): Promise<DashboardData> {
  const sk = singleKey(period)
  const stk = streakKey(period)
  const ck = countryKey(period)

  const p = redis.pipeline()
  p.get('lb:stats:plays')                          // 0
  p.get('lb:stats:dabs')                            // 1
  p.zcard(`lb:single:today:${todayKey()}`)          // 2
  p.zcard(`lb:streak:today:${todayKey()}`)          // 3
  p.zcard(sk)                                       // 4 single count
  p.zcard(stk)                                      // 5 streak count
  p.zrange(sk, 0, 4)                                // 6 top 5 single (asc = fastest)
  p.zrange(stk, 0, 4, { rev: true })               // 7 top 5 streak (desc = highest)
  p.zrange(ck, 0, 9, { rev: true, withScores: true }) // 8 top 10 countries
  p.zrange(sk, 0, 49)                               // 9 first 50 single scores for avg

  const results = await p.exec()

  const plays = Number(results[0]) || 0
  const dabs = Number(results[1]) || 0
  const singleToday = Number(results[2]) || 0
  const streakToday = Number(results[3]) || 0
  const playersToday = singleToday + streakToday
  const singleCount = Number(results[4]) || 0
  const streakCount = Number(results[5]) || 0

  const topSingle = parseScoreMembers(results[6] as string[]).map(s => ({
    username: s.username,
    time_ms: s.time_ms!,
  })).filter(s => s.time_ms != null)

  const topStreak = parseScoreMembers(results[7] as string[]).map(s => ({
    username: s.username,
    count: s.count!,
  })).filter(s => s.count != null)

  const rawCountries = results[8] as Array<string | number>
  const topCountries: Array<{ country: string; count: number }> = []
  for (let i = 0; i < rawCountries.length; i += 2) {
    topCountries.push({
      country: String(rawCountries[i]),
      count: Math.round(Number(rawCountries[i + 1])),
    })
  }

  const avgSamples = parseScoreMembers(results[9] as string[])
    .map(s => s.time_ms)
    .filter((t): t is number => t != null && t > 0)
  const avgReaction = avgSamples.length > 0
    ? Math.round(avgSamples.reduce((a, b) => a + b, 0) / avgSamples.length)
    : null

  return {
    plays, dabs, playersToday, avgReaction,
    modeSplit: { single: singleCount, streak: streakCount },
    topCountries, topSingle, topStreak, period,
  }
}

interface ScoreMember {
  username: string
  time_ms: number | null
  count: number | null
}

function parseScoreMembers(raw: string[]): ScoreMember[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(m => {
    if (typeof m !== 'string') return []
    try {
      const obj = JSON.parse(m)
      return [{
        username: obj.username ?? '???',
        time_ms: typeof obj.time_ms === 'number' ? obj.time_ms : null,
        count: typeof obj.count === 'number' ? obj.count : null,
      }]
    } catch { return [] }
  })
}
