/**
 * Generalized leaderboard / DB cleanup by username. Scans every leaderboard
 * sorted set, parses each member's JSON, and removes any whose `username`
 * matches one of `TARGET_USERNAMES`. Also decrements the country / play / dab
 * counters by the appropriate amount, then deletes any matching DB rows
 * (scores + users).
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-by-username.ts
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/cleanup-by-username.ts
 */
import { inArray } from 'drizzle-orm'
import {
  redis,
  weekKey,
  todayKey,
  countryAllKey,
  countryWeekKey,
  countryTodayKey,
} from '../src/lib/redis'
import { db } from '../src/lib/db'
import { scores, users } from '../src/lib/schema'

const TARGET_USERNAMES = ['countrytest3', 'testcountry', 'testcountry2']
const DRY = process.env.DRY_RUN === '1'

type Parsed = {
  id?: string
  username?: string
  time_ms?: number | null
  count?: number | null
  mode?: 'single' | 'streak'
  country?: string
}

async function scanAndRemove(key: string, ttlKey?: string) {
  const members = (await redis.zrange(key, 0, -1)) as string[]
  const toRemove: string[] = []
  const counters = { plays: 0, dabs: 0, country: {} as Record<string, number> }

  for (const m of members) {
    let parsed: Parsed | null = null
    try { parsed = JSON.parse(m) } catch { continue }
    if (!parsed?.username || !TARGET_USERNAMES.includes(parsed.username)) continue
    toRemove.push(m)
    counters.plays++
    counters.dabs += parsed.mode === 'streak' ? Number(parsed.count ?? 0) : 1
    const c = (parsed.country ?? 'XX').toUpperCase()
    counters.country[c] = (counters.country[c] ?? 0) + 1
  }

  if (toRemove.length === 0) {
    console.log(`[redis] ${key}: 0 matches`)
    return counters
  }

  console.log(`[redis] ${key}: ${toRemove.length} match(es)`)
  if (!DRY) {
    for (const m of toRemove) await redis.zrem(key, m)
  }
  return counters
}

async function main() {
  console.log(`[cleanup] targets=${TARGET_USERNAMES.join(',')} dry=${DRY}`)

  // Only the *all-time* key is authoritative for play / dab totals — week / today
  // keys are subsets of it, so we only count once but still ZREM from all.
  const singleAll = 'lb:single:all'
  const singleWeek = `lb:single:week:${weekKey()}`
  const singleToday = `lb:single:today:${todayKey()}`
  const streakAll = 'lb:streak:all'
  const streakWeek = `lb:streak:week:${weekKey()}`
  const streakToday = `lb:streak:today:${todayKey()}`

  const singleAllCounters = await scanAndRemove(singleAll)
  await scanAndRemove(singleWeek)
  await scanAndRemove(singleToday)

  const streakAllCounters = await scanAndRemove(streakAll)
  await scanAndRemove(streakWeek)
  await scanAndRemove(streakToday)

  const totalPlays = singleAllCounters.plays + streakAllCounters.plays
  const totalDabs = singleAllCounters.dabs + streakAllCounters.dabs
  const country: Record<string, number> = {}
  for (const [c, n] of Object.entries(singleAllCounters.country)) country[c] = (country[c] ?? 0) + n
  for (const [c, n] of Object.entries(streakAllCounters.country)) country[c] = (country[c] ?? 0) + n

  console.log(`[counters] plays=-${totalPlays} dabs=-${totalDabs} country=`, country)

  if (!DRY) {
    if (totalPlays > 0) await redis.decrby('lb:stats:plays', totalPlays)
    if (totalDabs > 0) await redis.decrby('lb:stats:dabs', totalDabs)
    const cAll = countryAllKey()
    const cW = countryWeekKey()
    const cT = countryTodayKey()
    for (const [c, n] of Object.entries(country)) {
      await redis.zincrby(cAll, -n, c)
      await redis.zincrby(cW, -n, c)
      await redis.zincrby(cT, -n, c)
    }
  }

  // DB scores: delete by username (covers both userId-linked and anonymous rows)
  const dbScores = await db.select().from(scores).where(inArray(scores.username, TARGET_USERNAMES))
  console.log(`[db] scores rows to delete: ${dbScores.length}`)
  if (!DRY && dbScores.length > 0) {
    await db.delete(scores).where(inArray(scores.username, TARGET_USERNAMES))
  }

  const dbUsers = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.username, TARGET_USERNAMES))
  console.log(`[db] users rows to delete: ${dbUsers.length}`, dbUsers)
  if (!DRY && dbUsers.length > 0) {
    await db.delete(users).where(inArray(users.username, TARGET_USERNAMES))
  }

  console.log('[cleanup] done')
}

main().catch(err => {
  console.error('[cleanup] failed:', err)
  process.exit(1)
})
