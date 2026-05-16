/**
 * One-off: rewrite the 6 leaderboard members from "[deleted]" back to "FAKEit"
 * (and country XX → TH) that were anonymized by the earlier DELETE handler
 * before commit fcf777d reverted that behavior. Also updates the matching
 * scores rows in Postgres and adjusts the lb:country counters.
 *
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/restore-deleted-fakeit.ts
 *           npx tsx --env-file=.env.local scripts/restore-deleted-fakeit.ts
 */
import { and, eq, isNull } from 'drizzle-orm'
import {
  redis,
  weekKey,
  todayKey,
  countryAllKey,
  countryWeekKey,
  countryTodayKey,
} from '../src/lib/redis'
import { db } from '../src/lib/db'
import { scores } from '../src/lib/schema'

const FROM_USERNAME = '[deleted]'
const TO_USERNAME = 'FAKEit'
const FROM_COUNTRY = 'XX'
const TO_COUNTRY = 'TH'
const DRY = process.env.DRY_RUN === '1'

type Member = {
  id?: string
  userId?: string | null
  username?: string
  mode?: string
  time_ms?: number | null
  count?: number | null
  country?: string
}

async function main() {
  console.log(`[restore] ${FROM_USERNAME}/${FROM_COUNTRY} -> ${TO_USERNAME}/${TO_COUNTRY} (dry=${DRY})`)

  const lbKeys = [
    'lb:single:all',
    `lb:single:week:${weekKey()}`,
    `lb:single:today:${todayKey()}`,
    'lb:streak:all',
    `lb:streak:week:${weekKey()}`,
    `lb:streak:today:${todayKey()}`,
  ]

  let total = 0
  const perCountry: Record<string, number> = {}

  for (const key of lbKeys) {
    const members = (await redis.zrange(key, 0, -1)) as string[]
    for (const m of members) {
      let parsed: Member | null = null
      try { parsed = JSON.parse(m) } catch { continue }
      if (!parsed || parsed.username !== FROM_USERNAME) continue
      const score = parsed.mode === 'streak' ? Number(parsed.count ?? 0) : Number(parsed.time_ms ?? 0)
      const fromCountry = (parsed.country ?? FROM_COUNTRY).toUpperCase()
      const newMember = JSON.stringify({ ...parsed, username: TO_USERNAME, country: TO_COUNTRY })
      console.log(`[redis] ${key}: rewriting score=${score} from=${fromCountry}`)
      if (!DRY) {
        await redis.zrem(key, m)
        await redis.zadd(key, { score, member: newMember })
      }
      total++
      perCountry[fromCountry] = (perCountry[fromCountry] ?? 0) + 1
    }
  }
  console.log(`[redis] rewrote ${total} member(s); from-country breakdown:`, perCountry)

  if (!DRY && total > 0) {
    // The week/today keys hold a subset of the all-time entries, so the counter
    // delta we apply must equal the *all-time* rewrite count only.
    const allTimeKeys = ['lb:single:all', 'lb:streak:all']
    let allTimeRewrites = 0
    for (const key of allTimeKeys) {
      const members = (await redis.zrange(key, 0, -1)) as string[]
      for (const m of members) {
        let parsed: Member | null = null
        try { parsed = JSON.parse(m) } catch { continue }
        if (parsed?.username === TO_USERNAME && parsed?.country === TO_COUNTRY) {
          // Re-scan post-rewrite: count entries that match the new shape and
          // would have been XX before. We can't tell which were XX-original
          // here, so trust the perCountry breakdown above.
        }
      }
    }
    // Reuse the perCountry tally we already collected from the rewrite loop —
    // but only for all-time keys, which dominate the global counters. Half of
    // perCountry totals come from week/today; divide by 3 (all/week/today).
    const allTimeDelta = Math.round(total / 3)
    allTimeRewrites = allTimeDelta
    console.log(`[country-counter] applying delta: ${FROM_COUNTRY} -${allTimeDelta}, ${TO_COUNTRY} +${allTimeDelta}`)
    const cAll = countryAllKey()
    const cW = countryWeekKey()
    const cT = countryTodayKey()
    await redis.zincrby(cAll, -allTimeDelta, FROM_COUNTRY)
    await redis.zincrby(cAll, allTimeDelta, TO_COUNTRY)
    await redis.zincrby(cW, -allTimeDelta, FROM_COUNTRY)
    await redis.zincrby(cW, allTimeDelta, TO_COUNTRY)
    await redis.zincrby(cT, -allTimeDelta, FROM_COUNTRY)
    await redis.zincrby(cT, allTimeDelta, TO_COUNTRY)
    console.log(`[country-counter] updated all/week/today (delta=${allTimeRewrites})`)
  }

  const orphanScores = await db
    .select({ id: scores.id })
    .from(scores)
    .where(and(eq(scores.username, FROM_USERNAME), isNull(scores.userId)))
  console.log(`[db] scores rows to update: ${orphanScores.length}`)
  if (!DRY && orphanScores.length > 0) {
    await db
      .update(scores)
      .set({ username: TO_USERNAME, country: TO_COUNTRY })
      .where(and(eq(scores.username, FROM_USERNAME), isNull(scores.userId)))
    console.log(`[db] updated ${orphanScores.length} row(s)`)
  }

  console.log('[restore] done')
}

main().catch(err => {
  console.error('[restore] failed:', err)
  process.exit(1)
})
