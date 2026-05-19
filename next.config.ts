import type { NextConfig } from 'next'

// Content Security Policy for dabpose.fun.
//
// - script-src includes Vercel Analytics + Speed Insights origins and the
//   jsdelivr CDN that hosts the pinned MediaPipe Holistic WASM bundle.
//   When MediaPipe is moved to a same-origin self-hosted path (see
//   security-audit finding C-01 / F-04), remove the jsdelivr entry.
// - img-src allows Google profile pictures (googleusercontent.com) and
//   Vercel preview hosts for OG images.
// - connect-src allows the MediaPipe CDN (WASM fetch) and Vercel insights.
// - frame-ancestors blocks clickjacking on the camera-permission flow.
// - 'unsafe-inline' on script-src is required for Next.js's runtime
//   hydration script and Framer Motion. Switch to a nonce-based CSP when
//   the project upgrades to Next.js 16 (which supports it natively).
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://vercel.live https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.vercel.app https://dabpose.fun",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://cdn.jsdelivr.net https://vitals.vercel-insights.com https://*.vercel-insights.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
] as const

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...securityHeaders],
      },
    ]
  },
}

export default nextConfig
