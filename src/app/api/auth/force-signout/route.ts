import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url))
  const cookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.csrf-token',
    '__Host-authjs.csrf-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
  ]
  for (const name of cookieNames) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  return response
}
