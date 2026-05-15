/**
 * Full wipe — clears every Dab Pose-owned key from Redis and every row from the
 * `users` and `scores` tables. Irreversible. Requires explicit `CONFIRM=NUKE`.
 *
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/nuke-all.ts
 *   CONFIRM=NUKE npx tsx --env-file=.env.local scripts/nuke-all.ts
 */
import { count } from 'drizzle-orm'
import { redis } from '../src/lib/redis'
import { db } from '../src/lib/db'
import { scores, users } from '../src/lib/schema'

const DRY = process.env.DRY_RUN === '1'
const CONFIRMED = process.env.CONFIRM === 'NUKE'

async function scanAll(pattern: string): Promise<string[]> {
  const out: string[] = []
  let cursor: string | number = 0
  do {
    const res = (await redis.scan(cursor, { match: pattern, count: 500 })) as [string | number, string[]]
    cursor = res[0]
    out.push(...res[1])
  } while (String(cursor) !== '0')
  return out
}

async function main() {
  if (!DRY && !CONFIRMED) {
    console.error('Refusing to run without CONFIRM=NUKE (or DRY_RUN=1 to preview).')
    process.exit(1)
  }
  console.log(`[nuke] dry=${DRY} confirmed=${CONFIRMED}`)

  const lbKeys = await scanAll('lb:*')
  console.log(`[redis] matched ${lbKeys.length} keys under lb:*`)
  console.log(`[redis] sample: ${lbKeys.slice(0, 10).join(', ')}${lbKeys.length > 10 ? ', …' : ''}`)

  const [scoreCountRow] = await db.select({ value: count() }).from(scores)
  const [userCountRow] = await db.select({ value: count() }).from(users)
  const scoreCount = scoreCountRow?.value ?? 0
  const userCount = userCountRow?.value ?? 0
  console.log(`[db] scores rows: ${scoreCount}, users rows: ${userCount}`)

  if (DRY) { console.log('[nuke] DRY_RUN=1 — no writes'); return }

  // DB first so any in-flight /api/score that already passed auth fails on insert
  // (FK to users) rather than producing an orphan score after the wipe.
  if (scoreCount > 0) {
    const scoresDel = await db.delete(scores)
    console.log(`[db] scores deleted:`, scoresDel)
  }
  if (userCount > 0) {
    const usersDel = await db.delete(users)
    console.log(`[db] users deleted:`, usersDel)
  }

  // Redis: batch DEL in chunks of 500 — Upstash REST has command-size limits.
  let removed = 0
  for (let i = 0; i < lbKeys.length; i += 500) {
    const chunk = lbKeys.slice(i, i + 500)
    if (chunk.length === 0) continue
    await redis.del(...chunk)
    removed += chunk.length
    process.stdout.write(`\r[redis] deleted ${removed}/${lbKeys.length}`)
  }
  process.stdout.write('\n')

  console.log('[nuke] done')
}

main().catch(err => {
  console.error('[nuke] failed:', err)
  process.exit(1)
})
