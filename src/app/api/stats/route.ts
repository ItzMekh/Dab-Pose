import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET() {
  const [rawPlays, rawDabs] = (await redis.mget('lb:stats:plays', 'lb:stats:dabs')) as Array<string | number | null>
  const totalPlays = rawPlays ? Number(rawPlays) : 0
  const totalDabs = rawDabs ? Number(rawDabs) : 0
  return NextResponse.json(
    { totalPlays, totalDabs },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
