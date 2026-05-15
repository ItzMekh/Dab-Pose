/**
 * Seed N synthetic players + scores for load / percentile testing.
 *
 *   COUNT=10000 npx tsx --env-file=.env.local scripts/seed-synthetic-players.ts
 *
 * For each player we insert:
 *   - 1 row in `users` (username `Seed${i}_${suffix}`, fake email, no password hash, random country)
 *   - 1..3 rows in `scores` (mix of single + streak) with random distributions
 *   - corresponding leaderboard ZADDs (lb:{single,streak}:all)
 *   - per-country counters and global play/dab counters incremented in bulk
 *
 * `DRY_RUN=1` previews the totals without writing.
 */
import { redis, countryAllKey, weekKey, todayKey, countryWeekKey, countryTodayKey } from '../src/lib/redis'
import { db } from '../src/lib/db'
import { scores, users } from '../src/lib/schema'
import { COUNTRIES } from '../src/lib/countries'

const COUNT = Number(process.env.COUNT ?? 10000)
const DRY = process.env.DRY_RUN === '1'
const BATCH = 500
const SUFFIX = Math.random().toString(36).slice(2, 8)

const COUNTRY_CODES = COUNTRIES.filter(c => c.code !== 'XX').map(c => c.code)

function pickCountry(): string {
  if (Math.random() < 0.3) return 'XX'
  return COUNTRY_CODES[Math.floor(Math.random() * COUNTRY_CODES.length)]
}

function randomTimeMs(): number {
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  const v = Math.round(600 + 250 * z)
  return Math.max(180, Math.min(2500, v))
}

function randomStreakCount(): number {
  const base = Math.floor(Math.random() * 6) + 3
  const tail = Math.random() < 0.1 ? Math.floor(Math.random() * 15) : 0
  return Math.max(0, Math.min(50, base + tail))
}

type SyntheticScore =
  | { mode: 'single'; timeMs: number; count: null; country: string }
  | { mode: 'streak'; timeMs: number | null; count: number; country: string }

function makeScoresForPlayer(): SyntheticScore[] {
  const n = 1 + Math.floor(Math.random() * 3)
  const out: SyntheticScore[] = []
  for (let i = 0; i < n; i++) {
    const country = pickCountry()
    if (Math.random() < 0.7) {
      out.push({ mode: 'single', timeMs: randomTimeMs(), count: null, country })
    } else {
      const c = randomStreakCount()
      out.push({ mode: 'streak', timeMs: c > 0 ? randomTimeMs() : null, count: c, country })
    }
  }
  return out
}

async function main() {
  console.log(`[seed] count=${COUNT} batch=${BATCH} suffix=${SUFFIX} dry=${DRY}`)

  type UserRow = { username: string; email: string; country: string; scores: SyntheticScore[] }
  const playersAll: UserRow[] = []
  let totalSingle = 0
  let totalStreak = 0
  let totalDabs = 0
  const countryTotals: Record<string, number> = {}

  for (let i = 0; i < COUNT; i++) {
    const username = `Seed${i}_${SUFFIX}`
    const email = `seed${i}_${SUFFIX}@dabpose.test`
    const country = pickCountry()
    const sc = makeScoresForPlayer()
    playersAll.push({ username, email, country, scores: sc })
    for (const s of sc) {
      if (s.mode === 'single') { totalSingle++; totalDabs++ }
      else { totalStreak++; totalDabs += s.count }
      countryTotals[s.country] = (countryTotals[s.country] ?? 0) + 1
    }
  }

  console.log(`[seed] generated ${playersAll.length} players, ${totalSingle} single + ${totalStreak} streak plays = ${totalSingle + totalStreak} total plays, ${totalDabs} dabs`)
  console.log(`[seed] country distribution:`, Object.entries(countryTotals).sort((a, b) => b[1] - a[1]).slice(0, 8))

  if (DRY) { console.log('[seed] DRY_RUN=1 — skipping writes'); return }

  const userIds: { username: string; id: string }[] = []
  for (let i = 0; i < playersAll.length; i += BATCH) {
    const chunk = playersAll.slice(i, i + BATCH)
    const inserted = await db
      .insert(users)
      .values(chunk.map(p => ({ username: p.username, email: p.email, country: p.country, passwordHash: null })))
      .returning({ id: users.id, username: users.username })
    userIds.push(...inserted)
    process.stdout.write(`\r[seed] users inserted: ${userIds.length}/${playersAll.length}`)
  }
  process.stdout.write('\n')

  const idByUsername = new Map(userIds.map(u => [u.username, u.id]))

  const wKey = weekKey()
  const tKey = todayKey()
  const cAll = countryAllKey()
  const cW = countryWeekKey()
  const cT = countryTodayKey()
  const nowIso = new Date().toISOString()
  let scoresInserted = 0
  let redisBatched = 0

  for (let i = 0; i < playersAll.length; i += BATCH) {
    const chunk = playersAll.slice(i, i + BATCH)
    const scoreRows: (typeof scores.$inferInsert)[] = []
    const singleMembers: { score: number; member: string }[] = []
    const streakMembers: { score: number; member: string }[] = []
    const countryDelta: Record<string, number> = {}

    for (const p of chunk) {
      const userId = idByUsername.get(p.username)
      if (!userId) continue
      for (const s of p.scores) {
        const id = crypto.randomUUID()
        scoreRows.push({
          id,
          userId,
          username: p.username,
          mode: s.mode,
          timeMs: s.timeMs,
          count: s.mode === 'streak' ? s.count : null,
          country: s.country,
          rankGlobal: null,
        })
        const member = JSON.stringify({
          id,
          userId,
          username: p.username,
          time_ms: s.timeMs,
          count: s.mode === 'streak' ? s.count : null,
          mode: s.mode,
          created_at: nowIso,
          country: s.country,
        })
        if (s.mode === 'single') {
          singleMembers.push({ score: s.timeMs!, member })
        } else {
          streakMembers.push({ score: s.count, member })
        }
        countryDelta[s.country] = (countryDelta[s.country] ?? 0) + 1
      }
    }

    if (scoreRows.length === 0) continue
    await db.insert(scores).values(scoreRows)
    scoresInserted += scoreRows.length

    const pipe = redis.pipeline()
    if (singleMembers.length > 0) {
      const [first, ...rest] = singleMembers
      pipe.zadd('lb:single:all', first, ...rest)
      pipe.zadd(`lb:single:week:${wKey}`, first, ...rest)
      pipe.zadd(`lb:single:today:${tKey}`, first, ...rest)
    }
    if (streakMembers.length > 0) {
      const [first, ...rest] = streakMembers
      pipe.zadd('lb:streak:all', first, ...rest)
      pipe.zadd(`lb:streak:week:${wKey}`, first, ...rest)
      pipe.zadd(`lb:streak:today:${tKey}`, first, ...rest)
    }
    for (const [c, n] of Object.entries(countryDelta)) {
      pipe.zincrby(cAll, n, c)
      pipe.zincrby(cW, n, c)
      pipe.zincrby(cT, n, c)
    }
    await pipe.exec()
    redisBatched += singleMembers.length + streakMembers.length
    process.stdout.write(`\r[seed] scores inserted: ${scoresInserted}; redis members: ${redisBatched}`)
  }
  process.stdout.write('\n')

  await redis.incrby('lb:stats:plays', totalSingle + totalStreak)
  await redis.incrby('lb:stats:dabs', totalDabs)
  console.log(`[seed] +${totalSingle + totalStreak} plays, +${totalDabs} dabs applied to global counters`)
  console.log('[seed] done')
}

main().catch(err => {
  console.error('[seed] failed:', err)
  process.exit(1)
})
