/**
 * One-off cleanup for in-session test pollution on FAKEit3.
 * Removes three single-mode entries (time_ms in [840, 1312, 5000]) from:
 *   - Redis sorted sets: lb:single:{all,week,today}
 *   - Country counters: lb:country:{all,week,today} (per-country decrement matched to removals)
 *   - Total plays counter: lb:stats:plays
 *   - DB scores table rows for those time_ms values
 *
 * Run from project root:
 *   npx tsx scripts/cleanup-test-pollution.ts
 *
 * Set DRY_RUN=1 to preview without writing.
 */
import { eq, and, inArray } from 'drizzle-orm'
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

const USERNAME = 'FAKEit3'
const TIMES_TO_DELETE = [840, 1312, 5000]
const DRY = process.env.DRY_RUN === '1'

async function main() {
  console.log(`[cleanup] target=${USERNAME} times=${TIMES_TO_DELETE.join(',')} dry=${DRY}`)

  const allKey = 'lb:single:all'
  const wKey = `lb:single:week:${weekKey()}`
  const tKey = `lb:single:today:${todayKey()}`
  const cAll = countryAllKey()
  const cW = countryWeekKey()
  const cT = countryTodayKey()
  console.log(`[cleanup] keys: ${allKey}, ${wKey}, ${tKey}`)

  const countryRemovals: Record<string, number> = {}
  let redisRemoved = 0

  for (const t of TIMES_TO_DELETE) {
    const members = (await redis.zrange(allKey, t, t, { byScore: true })) as string[]
    for (const m of members) {
      let parsed: { username?: string; time_ms?: number; country?: string; id?: string } | null = null
      try {
        parsed = JSON.parse(m)
      } catch {
        continue
      }
      if (!parsed || parsed.username !== USERNAME || parsed.time_ms !== t) continue
      const country = (parsed.country ?? 'XX').toUpperCase()
      console.log(`[redis] match id=${parsed.id} time_ms=${t} country=${country}`)
      if (!DRY) {
        await redis.zrem(allKey, m)
        await redis.zrem(wKey, m)
        await redis.zrem(tKey, m)
      }
      redisRemoved++
      countryRemovals[country] = (countryRemovals[country] ?? 0) + 1
    }
  }

  console.log(`[redis] removed ${redisRemoved} member(s); country decrements=`, countryRemovals)

  if (!DRY) {
    for (const [country, n] of Object.entries(countryRemovals)) {
      await redis.zincrby(cAll, -n, country)
      await redis.zincrby(cW, -n, country)
      await redis.zincrby(cT, -n, country)
    }
    if (redisRemoved > 0) {
      await redis.decrby('lb:stats:plays', redisRemoved)
    }
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, USERNAME))
    .limit(1)

  if (!user) {
    console.log(`[db] no user ${USERNAME}; skipping DB delete`)
    return
  }

  const candidates = await db
    .select()
    .from(scores)
    .where(
      and(
        eq(scores.userId, user.id),
        eq(scores.mode, 'single'),
        inArray(scores.timeMs, TIMES_TO_DELETE),
      ),
    )
  console.log(`[db] matched ${candidates.length} row(s)`, candidates.map(c => ({ id: c.id, timeMs: c.timeMs, country: c.country })))

  if (!DRY && candidates.length > 0) {
    const ids = candidates.map(c => c.id)
    await db.delete(scores).where(inArray(scores.id, ids))
    console.log(`[db] deleted ${ids.length} row(s)`)
  }

  console.log('[cleanup] done')
}

main().catch(err => {
  console.error('[cleanup] failed:', err)
  process.exit(1)
})
