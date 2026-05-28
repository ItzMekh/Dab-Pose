import { NextRequest, NextResponse } from 'next/server'
import { fetchDashboardData, type Period } from '@/lib/dashboard'

const VALID_PERIODS = new Set<Period>(['today', 'week', 'all'])

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('period') ?? 'all'
  const period: Period = VALID_PERIODS.has(raw as Period) ? (raw as Period) : 'all'

  const data = await fetchDashboardData(period)

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
