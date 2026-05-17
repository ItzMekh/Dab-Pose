import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from '@/components/Providers'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://dabpose.fun'),
  title: 'Dab Pose — How Fast Can You Dab?',
  description: 'Test your dab reaction speed with real-time pose detection.',
  alternates: { canonical: '/' },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon-192.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Dab Pose — How Fast Can You Dab?',
    description: 'Test your dab reaction speed with real-time pose detection.',
    type: 'website',
    url: 'https://dabpose.fun',
    images: [{ url: 'https://dabpose.fun/og.png', width: 1200, height: 630, alt: 'Dab Pose' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dab Pose — How Fast Can You Dab?',
    description: 'Test your dab reaction speed with real-time pose detection.',
    images: ['https://dabpose.fun/og.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={geist.className}>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
