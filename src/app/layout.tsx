import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dabspeed — How Fast Can You Dab?',
  description: 'Test your dab speed with real-time pose detection. Go viral.',
  openGraph: {
    title: 'Dabspeed',
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
