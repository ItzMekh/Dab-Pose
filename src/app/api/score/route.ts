import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const MIN_MS = 100
const MAX_MS = 30_000
const USERNAME_RE = /^[a-zA-Z0-9_\- ]{1,20}$/

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, time_ms, mode = 'single', count } = body as Record<string, unknown>

  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
  }
  if (mode !== 'single' && mode !== 'streak') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const supabase = createClient()

  if (mode === 'streak') {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      return NextResponse.json({ error: 'Invalid count' }, { status: 400 })
    }
    const bestMs = typeof time_ms === 'number' && Number.isInteger(time_ms) && time_ms >= MIN_MS && time_ms <= MAX_MS
      ? time_ms : null

    const { data, error } = await supabase
      .from('scores')
      .insert({ username: username.trim(), mode: 'streak', count, time_ms: bestMs })
      .select('id, username, count, time_ms, mode, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const [{ count: betterCount }, { count: totalCount }] = await Promise.all([
      supabase.from('scores').select('*', { count: 'exact', head: true }).eq('mode', 'streak').gt('count', count),
      supabase.from('scores').select('*', { count: 'exact', head: true }).eq('mode', 'streak'),
    ])
    const total = totalCount ?? 1
    const better = betterCount ?? 0
    const percentile = Math.round(((total - better) / total) * 100)
    const isKing = better === 0

    return NextResponse.json({ ...data, percentile, isKing }, { status: 201 })
  }

  // single mode
  if (typeof time_ms !== 'number' || !Number.isInteger(time_ms) || time_ms < MIN_MS || time_ms > MAX_MS) {
    return NextResponse.json({ error: 'Invalid time_ms' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scores')
    .insert({ username: username.trim(), mode: 'single', time_ms })
    .select('id, username, time_ms, mode, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [{ count: betterCount }, { count: totalCount }] = await Promise.all([
    supabase.from('scores').select('*', { count: 'exact', head: true }).eq('mode', 'single').lt('time_ms', time_ms),
    supabase.from('scores').select('*', { count: 'exact', head: true }).eq('mode', 'single'),
  ])
  const total = totalCount ?? 1
  const better = betterCount ?? 0
  const percentile = Math.round(((total - better) / total) * 100)
  const isKing = better === 0

  return NextResponse.json({ ...data, percentile, isKing }, { status: 201 })
}
