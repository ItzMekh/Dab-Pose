'use client'

import { useEffect, useRef } from 'react'

// Cloudflare-published "always passes" test key. Replaced at runtime by
// NEXT_PUBLIC_TURNSTILE_SITE_KEY when set in the Vercel env.
const FALLBACK_SITE_KEY = '1x00000000000000000000AA'
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || FALLBACK_SITE_KEY

interface TurnstileWidgetProps {
  onToken: (token: string) => void
  onError?: () => void
}

interface TurnstileGlobal {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
    },
  ) => string
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal
    onTurnstileReady?: () => void
  }
}

/**
 * Cloudflare Turnstile widget. Renders an invisible/managed challenge
 * (size auto-decided by CF) and calls onToken with the proof token once
 * the user passes. Server must verify the token via verifyTurnstile().
 *
 * Loads the Turnstile script once per page; safe to mount multiple
 * widgets — the global script auto-discovers any element with the
 * `cf-turnstile` class on load.
 */
export default function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const onErrorRef = useRef(onError)
  onTokenRef.current = onToken
  onErrorRef.current = onError

  useEffect(() => {
    let cancelled = false

    function tryRender() {
      if (cancelled) return
      const ts = window.turnstile
      const el = containerRef.current
      if (!ts || !el) return
      if (widgetIdRef.current) return
      widgetIdRef.current = ts.render(el, {
        sitekey: SITE_KEY,
        theme: 'dark',
        callback: (t: string) => onTokenRef.current?.(t),
        'error-callback': () => onErrorRef.current?.(),
        'expired-callback': () => onErrorRef.current?.(),
      })
    }

    // If script already loaded
    if (window.turnstile) {
      tryRender()
    } else if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady'
      s.async = true
      s.defer = true
      s.dataset.turnstile = '1'
      document.head.appendChild(s)
      window.onTurnstileReady = tryRender
    } else {
      // Script is loading, poll once it's ready
      const poll = setInterval(() => {
        if (window.turnstile) { clearInterval(poll); tryRender() }
      }, 100)
      // Don't leak interval if component unmounts before script loads
      return () => { cancelled = true; clearInterval(poll) }
    }

    return () => { cancelled = true }
  }, [])

  return <div ref={containerRef} className="flex justify-center" />
}
