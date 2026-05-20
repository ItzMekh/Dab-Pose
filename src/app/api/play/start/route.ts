import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { logError } from '@/lib/log'
import { isSameOrigin } from '@/lib/csrf'

// Proof-of-play token issuer.
//
// Closes audit finding A-01 (anonymous-score forgery). The client must
// POST here at game start to receive a single-use token. The token is
// stored in Redis with a 60s TTL; /api/score consumes it via GETDEL and
// verifies that the submitted time_ms / streak duration is plausible
// against the elapsed time since the token was issued.
//
// Rate-limit is not strictly necessary here because:
//   - Tokens are single-use (GETDEL on score submit).
//   - Vercel WAF already rate-limits POST /api/score itself.
// We still enforce CSRF so a third-party page cannot prime tokens.

const TOKEN_TTL_SEC = 60

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = crypto.randomUUID()
  const issuedAt = Date.now()

  try {
    await redis.set(`play:tok:${token}`, String(issuedAt), { ex: TOKEN_TTL_SEC })
  } catch (err) {
    logError('/api/play/start', err, { context: 'Redis set error' })
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    )
  }

  return NextResponse.json(
    { token, issuedAt, ttl: TOKEN_TTL_SEC },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
