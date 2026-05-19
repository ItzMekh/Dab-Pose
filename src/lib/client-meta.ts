// Cloudflare-aware client metadata helpers.
//
// dabpose.fun sits behind a Cloudflare proxy (orange-cloud DNS) which terminates
// the user's connection and forwards to Vercel. After this change:
// - CF-Connecting-IP is the real client IP (Vercel's x-forwarded-for first hop is now Cloudflare).
// - CF-IPCountry is the geo header (Vercel's x-vercel-ip-country still works but reflects Cloudflare's
//   egress IP, not the visitor's — must not be trusted for country).
//
// Each helper reads the Cloudflare header first, then falls back to the Vercel
// header for graceful behavior when the proxy is temporarily disabled.

const COUNTRY_RE = /^[A-Z]{2}$/

function resolveCountry(cf: string | null | undefined, vercel: string | null | undefined): string {
  // If the Cloudflare proxy is in front, CF-IPCountry is authoritative for
  // the visitor's geo. Don't fall back to the Vercel header — Vercel sees the
  // Cloudflare egress IP, not the real client, so its country is meaningless.
  // CF returns "T1" for Tor exits and "XX" for unknown; both normalize to XX.
  if (cf) {
    const c = cf.toUpperCase()
    return COUNTRY_RE.test(c) && c !== 'XX' && c !== 'T1' ? c : 'XX'
  }
  // No CF header → Vercel is the only edge in front of us, trust it.
  const v = vercel?.toUpperCase() ?? ''
  return COUNTRY_RE.test(v) ? v : 'XX'
}

export function clientCountry(req: Request): string {
  return resolveCountry(req.headers.get('cf-ipcountry'), req.headers.get('x-vercel-ip-country'))
}

export function clientCountryFromHeaders(h: Headers): string {
  return resolveCountry(h.get('cf-ipcountry'), h.get('x-vercel-ip-country'))
}
