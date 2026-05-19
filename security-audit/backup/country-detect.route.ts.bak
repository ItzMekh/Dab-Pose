import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Vercel sets this header automatically from IP geolocation
  const country = req.headers.get('x-vercel-ip-country') ?? 'XX'
  // 'XX' means unknown/undetectable (VPN, missing header in dev)
  return NextResponse.json(
    { country: country.toUpperCase() },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
