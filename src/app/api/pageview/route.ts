import { NextRequest } from 'next/server'
import { redis, todayKey, weekKey } from '@/lib/redis'
import { pageviewLimiter, clientIp } from '@/lib/ratelimit'
import { clientCountry } from '@/lib/client-meta'

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' } as const
const BOT_RE = /bot|crawler|spider|scrape|preview|monitor|headless|lighthouse|curl|wget|axios/i
const TABLET_RE = /tablet|ipad/i
const MOBILE_RE = /mobi|android|iphone|ipod/i
const PV_TTL = 14 * 24 * 3600

function silent(status = 204): Response {
  return new Response(null, { status, headers: SECURITY_HEADERS })
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''
  if (BOT_RE.test(ua)) return silent()

  const ip = clientIp(req)
  if (ip) {
    try {
      const rl = await pageviewLimiter.limit(ip)
      if (!rl.success) return silent()
    } catch {
      // fail open — analytics, not security
    }
  }

  let body: { path?: unknown }
  try { body = await req.json() } catch { return silent(400) }

  const path = typeof body.path === 'string' ? body.path : ''
  if (!path || path.length > 200 || !path.startsWith('/')) return silent(400)
  if (path.startsWith('/dashboard') || path.startsWith('/api')) return silent()

  const referer = req.headers.get('referer') ?? ''
  let refHost = '(direct)'
  if (referer) {
    try {
      const url = new URL(referer)
      const h = url.hostname
      if (h !== 'localhost' && !h.endsWith('dabpose.fun')) refHost = h
    } catch { /* keep direct */ }
  }

  const device = TABLET_RE.test(ua) ? 'tablet' : MOBILE_RE.test(ua) ? 'mobile' : 'desktop'
  const country = clientCountry(req)
  const today = todayKey()
  const week = weekKey()

  try {
    const p = redis.pipeline()
    p.incr('lb:pv:total')
    p.incr(`lb:pv:today:${today}`)
    p.expire(`lb:pv:today:${today}`, PV_TTL)
    p.incr(`lb:pv:week:${week}`)
    p.expire(`lb:pv:week:${week}`, PV_TTL)
    p.zincrby('lb:pv:path', 1, path)
    p.zincrby('lb:pv:ref', 1, refHost)
    p.zincrby('lb:pv:dev', 1, device)
    p.zincrby('lb:pv:country', 1, country)
    await p.exec()
  } catch {
    // Analytics best-effort — don't surface Redis errors to client
  }

  return silent()
}
