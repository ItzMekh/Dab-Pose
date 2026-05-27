import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url))
  response.cookies.delete('authjs.session-token')
  response.cookies.delete('__Secure-authjs.session-token')
  return response
}
