'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function PageviewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (pathname.startsWith('/dashboard')) return

    const controller = new AbortController()
    fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => { /* analytics best-effort */ })

    return () => controller.abort()
  }, [pathname])

  return null
}
