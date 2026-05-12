import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'streak' ? 'streak' : 'single'
  const supabase = createClient()

  const query = supabase
    .from('scores')
    .select('id, username, time_ms, count, mode, created_at')
    .eq('mode', mode)
    .limit(100)

  const { data, error } = mode === 'streak'
    ? await query.order('count', { ascending: false })
    : await query.order('time_ms', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
