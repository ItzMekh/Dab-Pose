import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'streak' ? 'streak' : 'single'
  const period = req.nextUrl.searchParams.get('period') // 'week' | 'today' | null = all time
  const supabase = createClient()

  let q = supabase
    .from('scores')
    .select('id, username, time_ms, count, mode, created_at')
    .eq('mode', mode)
    .limit(100)

  if (period === 'week') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    q = q.gte('created_at', weekAgo)
  } else if (period === 'today') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    q = q.gte('created_at', todayStart.toISOString())
  }

  const { data, error } = mode === 'streak'
    ? await q.order('count', { ascending: false })
    : await q.order('time_ms', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
