import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (req.auth) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/signup', '/login'],
}
