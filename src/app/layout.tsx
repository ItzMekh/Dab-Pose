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
  openGraph: {
    title: 'Dab Pose',
    description: 'How fast can you dab?',
    type: 'website',
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
