import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
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
      }, 5000)

      const timeoutId = setTimeout(() => cleanupFn?.(), 270_000)

      cleanupFn = () => {
        clearInterval(intervalId)
        clearTimeout(timeoutId)
        if (!closed) { closed = true; controller.close() }
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
