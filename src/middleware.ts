import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { clientCountryFromHeaders } from '@/lib/client-meta'

const COUNTRY_COOKIE = '__dab_country'

export default auth((req) => {
  const country = clientCountryFromHeaders(req.headers)

  const headers = new Headers(req.headers)
  headers.set('x-dab-country', country)

  const isAuthedOnAuthPage =
    !!req.auth && (req.nextUrl.pathname === '/signup' || req.nextUrl.pathname === '/login')

  const res = isAuthedOnAuthPage
    ? NextResponse.redirect(new URL('/', req.url))
    : NextResponse.next({ request: { headers } })

  res.cookies.set(COUNTRY_COOKIE, country, {
    maxAge: 600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
  return res
})

export const config = {
  matcher: ['/signup', '/login', '/api/auth/:path*'],
}
