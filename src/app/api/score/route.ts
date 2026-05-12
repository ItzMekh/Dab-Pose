import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { username, time_ms } = await req.json()

  if (!username || typeof time_ms !== 'number' || time_ms <= 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('scores')
    .insert({ username: username.slice(0, 20), time_ms })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
