import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { clientCountryFromHeaders } from '@/lib/client-meta'

export default auth((req) => {
  const country = clientCountryFromHeaders(req.headers)

  const headers = new Headers(req.headers)
  // Strip any client-supplied x-dab-country before injecting the
  // server-resolved value. Without this, a client could spoof their
  // country by setting the header directly on routes inside the matcher.
  headers.delete('x-dab-country')
  headers.set('x-dab-country', country)

  const isAuthedOnAuthPage =
    !!req.auth && (req.nextUrl.pathname === '/signup' || req.nextUrl.pathname === '/login')

  return isAuthedOnAuthPage
    ? NextResponse.redirect(new URL('/', req.url))
    : NextResponse.next({ request: { headers } })
})

export const config = {
  matcher: ['/signup', '/login', '/api/auth/:path*'],
}
