// Cloudflare Turnstile server-side verification.
//
// Closes audit finding AU-02 — adds a bot challenge to /api/auth/signup
// and the Credentials provider's authorize() path. Turnstile is the
// Cloudflare CAPTCHA replacement: invisible by default, no third-party
// trackers, free.
//
// To enable in production:
//   1. Go to https://dash.cloudflare.com → Turnstile → Add Site → "dabpose.fun".
//   2. Pick "Managed" widget type.
//   3. Copy the Site Key into NEXT_PUBLIC_TURNSTILE_SITE_KEY (Vercel env).
//   4. Copy the Secret Key into TURNSTILE_SECRET_KEY (Vercel env).
//
// Until those env vars are set, the helpers fall through to Cloudflare's
// public "always passes" test keys, which makes the gate a no-op. The
// site key default also doubles as a smoke-test value during local dev.

// Cloudflare-published TEST keys (documented at developers.cloudflare.com).
// "always-pass" pair so the site does not break before the owner sets real keys.
const TEST_SITE_KEY = '1x00000000000000000000AA'
const TEST_SECRET = '1x0000000000000000000000000000000AA'

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY
const TURNSTILE_SECRET =
  process.env.TURNSTILE_SECRET_KEY || TEST_SECRET

interface SiteverifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

/**
 * Verify a Turnstile response token server-side. Returns true on success,
 * false on any failure or network error. Caller decides the failure
 * response shape.
 */
export async function verifyTurnstile(token: string | undefined, remoteIp?: string | null): Promise<boolean> {
  if (typeof token !== 'string' || token.length < 8) return false
  try {
    const form = new URLSearchParams()
    form.set('secret', TURNSTILE_SECRET)
    form.set('response', token)
    if (remoteIp) form.set('remoteip', remoteIp)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const data = (await res.json()) as SiteverifyResponse
    return !!data.success
  } catch (err) {
    console.error('[turnstile] verify error:', err)
    return false
  }
}
