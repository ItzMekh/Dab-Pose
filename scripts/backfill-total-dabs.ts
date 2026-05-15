/**
 * Backfill lb:stats:dabs from historical leaderboard entries.
 *
 *   single mode -> 1 dab per entry  (ZCARD lb:single:all)
 *   streak mode -> count per entry  (sum of scores in lb:streak:all)
 *
 * Run from project root:
 *   npx tsx --env-file=.env.local scripts/backfill-total-dabs.ts
 *
 * Set DRY_RUN=1 to preview without writing.
 */
import { redis } from '../src/lib/redis'

const DRY = process.env.DRY_RUN === '1'

async function main() {
  const singleCount = (await redis.zcard('lb:single:all')) as number

  const streakRaw = (await redis.zrange('lb:streak:all', 0, -1, { withScores: true })) as Array<string | number>
  let streakSum = 0
  for (let i = 1; i < streakRaw.length; i += 2) {
    streakSum += Number(streakRaw[i])
  }

  const totalDabs = singleCount + streakSum
  const existing = (await redis.get('lb:stats:dabs')) as string | number | null
  const existingNum = existing ? Number(existing) : 0

  console.log(`single entries:    ${singleCount}`)
  console.log(`streak entries:    ${streakRaw.length / 2}`)
  console.log(`streak dabs total: ${streakSum}`)
  console.log(`computed dabs:     ${totalDabs}`)
  console.log(`current counter:   ${existingNum}`)

  if (DRY) {
    console.log('DRY_RUN=1 — skipping SET')
    return
  }

  await redis.set('lb:stats:dabs', totalDabs)
  console.log(`SET lb:stats:dabs ${totalDabs} ✓`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
