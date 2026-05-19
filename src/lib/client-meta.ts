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

export function clientCountry(req: Request): string {
  const cf = req.headers.get('cf-ipcountry')?.toUpperCase() ?? ''
  if (COUNTRY_RE.test(cf) && cf !== 'XX' && cf !== 'T1') return cf
  const v = req.headers.get('x-vercel-ip-country')?.toUpperCase() ?? ''
  if (COUNTRY_RE.test(v)) return v
  return 'XX'
}

export function clientCountryFromHeaders(h: Headers): string {
  const cf = h.get('cf-ipcountry')?.toUpperCase() ?? ''
  if (COUNTRY_RE.test(cf) && cf !== 'XX' && cf !== 'T1') return cf
  const v = h.get('x-vercel-ip-country')?.toUpperCase() ?? ''
  if (COUNTRY_RE.test(v)) return v
  return 'XX'
}
