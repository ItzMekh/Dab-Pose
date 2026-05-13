import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET() {
  const raw = await redis.get('lb:stats:plays') as string | number | null
  const totalPlays = raw ? Number(raw) : 0
  return NextResponse.json(
    { totalPlays },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
