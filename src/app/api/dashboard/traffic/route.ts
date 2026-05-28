import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'

const VERCEL_API = 'https://vercel.com/api/web/insights'
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff' } as const

export async function GET(req: NextRequest) {
  const { admin } = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: SECURITY_HEADERS })
  }

  const token = process.env.VERCEL_ACCESS_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token || !projectId) {
    return NextResponse.json({
      unavailable: true,
      message: 'VERCEL_ACCESS_TOKEN or VERCEL_PROJECT_ID not configured',
    }, { headers: SECURITY_HEADERS })
  }

  const section = req.nextUrl.searchParams.get('section')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  try {
    const params = new URLSearchParams({ projectId })
    if (teamId) params.set('teamId', teamId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    const headers = { Authorization: `Bearer ${token}` }

    if (section === 'pages') {
      const res = await fetch(`${VERCEL_API}/stats/path?${params}`, { headers })
      const json = await res.json()
      return NextResponse.json({ topPages: json.data ?? [] }, { headers: SECURITY_HEADERS })
    }

    if (section === 'referrers') {
      const res = await fetch(`${VERCEL_API}/stats/referrer?${params}`, { headers })
      const json = await res.json()
      return NextResponse.json({ referrers: json.data ?? [] }, { headers: SECURITY_HEADERS })
    }

    if (section === 'devices') {
      const [devRes, brRes] = await Promise.all([
        fetch(`${VERCEL_API}/stats/device?${params}`, { headers }),
        fetch(`${VERCEL_API}/stats/browser?${params}`, { headers }),
      ])
      const [devJson, brJson] = await Promise.all([devRes.json(), brRes.json()])
      return NextResponse.json({
        devices: devJson.data ?? [],
        browsers: brJson.data ?? [],
      }, { headers: SECURITY_HEADERS })
    }

    if (section === 'countries') {
      const res = await fetch(`${VERCEL_API}/stats/country?${params}`, { headers })
      const json = await res.json()
      return NextResponse.json({ byCountry: json.data ?? [] }, { headers: SECURITY_HEADERS })
    }

    // Default: overview stats
    const res = await fetch(`${VERCEL_API}/stats?${params}`, { headers })
    const json = await res.json()
    return NextResponse.json(json, { headers: SECURITY_HEADERS })
  } catch {
    return NextResponse.json(
      { unavailable: true, message: 'Vercel Analytics API error' },
      { status: 502, headers: SECURITY_HEADERS },
    )
  }
}
