// Structured error logger with PII redaction. Replaces ad-hoc
// console.error calls so secrets, passwords, and email addresses
// inside thrown error objects do not bleed into Vercel platform logs.
//
// Closes audit finding C-16.

const REDACT_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'currentpassword',
  'newpassword',
  'token',
  'turnstiletoken',
  'turnstile_secret_key',
  'authorization',
  'cookie',
  'set-cookie',
  'database_url',
  'auth_secret',
  'upstash_redis_rest_token',
  'apikey',
  'api_key',
  'secret',
])

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]'
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1))
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]'
    } else if (typeof v === 'string' && /[\w.+-]+@[\w-]+\.[\w.-]+/.test(v) && !k.toLowerCase().includes('userid')) {
      out[k] = '[email-redacted]'
    } else {
      out[k] = redact(v, depth + 1)
    }
  }
  return out
}

export function logError(scope: string, err: unknown, meta?: Record<string, unknown>): void {
  const e = err as { message?: string; name?: string; code?: string; cause?: unknown } | null
  const payload = {
    scope,
    name: e?.name,
    message: e?.message,
    code: e?.code,
    cause: e?.cause ? redact(e.cause) : undefined,
    meta: meta ? redact(meta) : undefined,
  }
  console.error(`[${scope}]`, JSON.stringify(payload))
}
