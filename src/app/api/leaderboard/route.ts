import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scores')
    .select('id, username, time_ms, created_at')
    .order('time_ms', { ascending: true })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
