import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/', req.url))
  const insecure = ['authjs.session-token', 'authjs.csrf-token', 'authjs.callback-url']
  const secure = ['__Secure-authjs.session-token', '__Secure-authjs.csrf-token', '__Secure-authjs.callback-url', '__Host-authjs.csrf-token']
  for (const name of insecure) {
    response.cookies.set(name, '', { maxAge: 0, path: '/', httpOnly: true })
  }
  for (const name of secure) {
    response.cookies.set(name, '', { maxAge: 0, path: '/', httpOnly: true, secure: true })
  }
  return response
}
