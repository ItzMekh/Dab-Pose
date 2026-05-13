import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let lastVersion = -1
      let closed = false
      let intervalId: ReturnType<typeof setInterval>
      let timeoutId: ReturnType<typeof setTimeout>

      const cleanup = () => {
        clearInterval(intervalId)
        clearTimeout(timeoutId)
        if (!closed) { closed = true; controller.close() }
      }

      // Confirm connection immediately
      controller.enqueue(encoder.encode(': connected\n\n'))

      intervalId = setInterval(async () => {
        try {
          const raw = await redis.get('lb:stats:plays') as string | number | null
          const version = raw ? Number(raw) : 0
          if (version !== lastVersion) {
            lastVersion = version
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ v: version })}\n\n`))
          } else {
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch {
          cleanup()
        }
      }, 5000)

      // Close before Vercel's 300 s function timeout so EventSource reconnects cleanly
      timeoutId = setTimeout(cleanup, 270_000)
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
