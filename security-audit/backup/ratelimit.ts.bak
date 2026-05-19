import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Dedicated Redis client for @upstash/ratelimit. The main `redis` export in
// ./redis.ts disables automaticDeserialization for the leaderboard JSON
// snapshots; the ratelimit lib expects default behavior, so use its own client.
const rlRedis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const signupLimiter = new Ratelimit({
  redis: rlRedis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: false,
  prefix: 'rl:signup',
})

export const settingsLimiter = new Ratelimit({
  redis: rlRedis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: false,
  prefix: 'rl:settings',
})

export const passwordChangeLimiter = new Ratelimit({
  redis: rlRedis,
  limiter: Ratelimit.slidingWindow(3, '300 s'),
  analytics: false,
  prefix: 'rl:pwchange',
})

export const eventsLimiter = new Ratelimit({
  redis: rlRedis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: false,
  prefix: 'rl:events',
})

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0].trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  return real && real.length > 0 ? real : null
}

// In production we require a real client IP — otherwise every unidentified
// caller shares the literal key 'unknown' and one attacker can DOS legitimate
// users into the same bucket. In dev there's no proxy, so fall back.
export function clientIpOrFail(req: Request): string {
  const ip = clientIp(req)
  if (ip) return ip
  if (process.env.VERCEL === '1') {
    throw new Error('CLIENT_IP_MISSING')
  }
  return 'dev-local'
}
