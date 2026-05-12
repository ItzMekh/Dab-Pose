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

  const { username, time_ms } = body as Record<string, unknown>

  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
  }
  if (typeof time_ms !== 'number' || !Number.isInteger(time_ms) || time_ms < MIN_MS || time_ms > MAX_MS) {
    return NextResponse.json({ error: 'Invalid time_ms' }, { status: 400 })
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('scores')
    .insert({ username: username.trim(), time_ms })
    .select('id, username, time_ms, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Percentile: how many players have a strictly faster time
  const [{ count: betterCount }, { count: totalCount }] = await Promise.all([
    supabase.from('scores').select('*', { count: 'exact', head: true }).lt('time_ms', time_ms),
    supabase.from('scores').select('*', { count: 'exact', head: true }),
  ])

  const total = totalCount ?? 1
  const better = betterCount ?? 0
  const percentile = Math.round(((total - better) / total) * 100)
  const isKing = better === 0

  return NextResponse.json({ ...data, percentile, isKing }, { status: 201 })
}
