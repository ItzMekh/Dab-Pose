import { NextRequest, NextResponse } from 'next/server'
import { clientCountry } from '@/lib/client-meta'

export async function GET(req: NextRequest) {
  // Cloudflare-aware: prefers CF-IPCountry, falls back to x-vercel-ip-country.
  // 'XX' means unknown/undetectable (VPN, missing header in dev, Cloudflare T1 = Tor).
  const country = clientCountry(req)
  return NextResponse.json(
    { country },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
