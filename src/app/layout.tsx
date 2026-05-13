import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Dab Pose — How Fast Can You Dab?',
  description: 'Test your dab reaction speed with real-time pose detection.',
  icons: { icon: '/favicon.png', shortcut: '/favicon.png' },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Dab Pose — How Fast Can You Dab?',
    description: 'Test your dab reaction speed with real-time pose detection.',
    type: 'website',
    url: 'https://dab-pose.vercel.app',
    images: [{ url: 'https://dab-pose.vercel.app/og.png', width: 1200, height: 630, alt: 'Dab Pose' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dab Pose — How Fast Can You Dab?',
    description: 'Test your dab reaction speed with real-time pose detection.',
    images: ['https://dab-pose.vercel.app/og.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={geist.className}>
        {children}
      </body>
    </html>
  )
}
