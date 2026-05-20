import { createHash } from 'crypto'

// Closes audit finding C-17. Server-side password policy:
//   - length 10..128 (lower bound up from 8; cap matches bcrypt's 72-byte
//     truncation boundary plus slack for multi-byte chars)
//   - reject passwords known to be in public breach corpora via the
//     Have I Been Pwned k-anonymity API (only the SHA-1 prefix is sent;
//     full hash never leaves the server)
//
// The HIBP check fails open on network error so a third-party outage
// cannot lock users out of signup or password change. A future
// background log + alert can tighten that if needed.

const MIN_LEN = 10
const MAX_LEN = 128

export interface PasswordCheckResult {
  ok: boolean
  error?: string
}

export async function checkPassword(password: string): Promise<PasswordCheckResult> {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Password is required' }
  }
  if (password.length < MIN_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_LEN} characters` }
  }
  if (password.length > MAX_LEN) {
    return { ok: false, error: `Password must be at most ${MAX_LEN} characters` }
  }
  if (await isPwned(password)) {
    return {
      ok: false,
      error:
        'This password appears in known data breaches — please pick a different one. ' +
        'See https://haveibeenpwned.com/Passwords for context.',
    }
  }
  return { ok: true }
}

async function isPwned(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [hashSuffix] = line.split(':')
      if (hashSuffix.trim().toUpperCase() === suffix) return true
    }
    return false
  } catch (err) {
    console.error('[password] HIBP check failed (fail open):', err)
    return false
  }
}
