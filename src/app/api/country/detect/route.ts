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
        // Browser-cached for an hour: country detection is per-IP and stable
        // within a session. Reduces ~360ms cold-start hits on repeat visits.
        // `private` so CDN/Vercel won't cache (country varies per IP).
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  )
}
