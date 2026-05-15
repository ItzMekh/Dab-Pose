import { redis, weekKey, todayKey } from './redis'

const LEADERBOARD_KEYS = (): string[] => [
  'lb:single:all',
  `lb:single:week:${weekKey()}`,
  `lb:single:today:${todayKey()}`,
  'lb:streak:all',
  `lb:streak:week:${weekKey()}`,
  `lb:streak:today:${todayKey()}`,
]

type Member = {
  id?: string
  userId?: string | null
  username?: string
  [k: string]: unknown
}

export async function rewriteLeaderboardUsername(
  userId: string,
  oldUsername: string,
  newUsername: string,
): Promise<{ scanned: number; rewritten: number }> {
  let scanned = 0
  let rewritten = 0

  for (const key of LEADERBOARD_KEYS()) {
    const raw = (await redis.zrange(key, 0, -1, { withScores: true })) as (string | number)[]
    if (raw.length === 0) continue

    const updates: Array<{ oldMember: string; newMember: string; score: number }> = []
    for (let i = 0; i < raw.length; i += 2) {
      const oldMember = raw[i] as string
      const score = Number(raw[i + 1])
      scanned++
      let parsed: Member
      try {
        parsed = JSON.parse(oldMember) as Member
      } catch {
        continue
      }
      const matchesById = !!parsed.userId && parsed.userId === userId
      const matchesByName = !parsed.userId && parsed.username === oldUsername
      if (!matchesById && !matchesByName) continue
      const newMember = JSON.stringify({ ...parsed, userId, username: newUsername })
      updates.push({ oldMember, newMember, score })
    }

    if (updates.length === 0) continue

    const pipe = redis.pipeline()
    for (const u of updates) {
      pipe.zrem(key, u.oldMember)
      pipe.zadd(key, { score: u.score, member: u.newMember })
    }
    await pipe.exec()
    rewritten += updates.length
  }

  return { scanned, rewritten }
}
