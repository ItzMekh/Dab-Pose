import type { Score } from '@/types'

const MIN_SCORE_MS = 100
const MAX_SCORE_MS = 30_000
const USERNAME_RE = /^[a-zA-Z0-9_\- ]{1,20}$/
const SUBMIT_TIMEOUT_MS = 5000

export async function fetchLeaderboard(mode: 'single' | 'streak'): Promise<Score[]> {
  try {
    const res = await fetch(`/api/leaderboard?mode=${mode}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export function validateUsername(name: string): string | null {
  if (!name.trim()) return 'Name required'
  if (!USERNAME_RE.test(name.trim())) return 'Letters, numbers, _ - space only (max 20)'
  return null
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastErr: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      })
      if (res.status === 400) return res  // validation error — don't retry
      if (res.ok) return res
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (i < retries) await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw lastErr ?? new Error('Request failed')
}

export interface SubmitPayload {
  username: string
  time_ms?: number
  mode?: 'single' | 'streak'
  count?: number
  country?: string  // ISO 3166-1 alpha-2 or 'XX'
}

export interface SubmitResult {
  ok: boolean
  error?: string
  percentile?: number
  isKing?: boolean
}

export async function submitScore(payload: SubmitPayload): Promise<SubmitResult> {
  if (payload.mode !== 'streak' && (payload.time_ms === undefined || payload.time_ms < MIN_SCORE_MS || payload.time_ms > MAX_SCORE_MS)) {
    return { ok: false, error: 'Invalid score' }
  }
  try {
    const res = await fetchWithRetry('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error ?? 'Submission failed' }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: true, percentile: data.percentile, isKing: data.isKing }
  } catch {
    return { ok: false, error: 'Network error — score not saved' }
  }
}
