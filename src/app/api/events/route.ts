import { redis } from '@/lib/redis'
import { eventsLimiter, clientIpOrFail } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  let ip: string
  try {
    ip = clientIpOrFail(req)
  } catch {
    return new Response('Client IP missing', { status: 400 })
  }

  try {
    const rl = await eventsLimiter.limit(ip)
    if (!rl.success) {
      const retryAfter = Math.max(1, Math.min(3600, Math.ceil((rl.reset - Date.now()) / 1000)))
      return new Response('Too many connections', {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      })
    }
  } catch (e) {
    // Fail open for the live-event stream — anti-spam, not a security boundary.
    // Log so an outage is visible.
    console.error('[/api/events] ratelimit error, allowing through:', e)
  }

  const encoder = new TextEncoder()
  let cleanupFn: (() => void) | null = null

  const stream = new ReadableStream({
    async start(controller) {
      let lastVersion = -1
      let closed = false

      controller.enqueue(encoder.encode(': connected\n\n'))

      const intervalId = setInterval(async () => {
        try {
          const raw = await redis.get('lb:stats:plays') as string | number | null
          const version = raw ? Number(raw) : 0
          if (version !== lastVersion) {
            lastVersion = version
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ v: version })}\n\n`))
          } else {
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch (e) {
          console.error('[/api/events] Redis error:', e)
          cleanupFn?.()
        }
      }, 2000)

      const timeoutId = setTimeout(() => cleanupFn?.(), 270_000)

      cleanupFn = () => {
        clearInterval(intervalId)
        clearTimeout(timeoutId)
        if (!closed) {
          closed = true
          // Controller may already be closed if the client aborted — swallow.
          try { controller.close() } catch {}
        }
      }
    },
    cancel() {
      cleanupFn?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
