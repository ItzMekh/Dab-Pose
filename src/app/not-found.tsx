import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Dab Pose',
  description: 'This page does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-3">
        <p className="text-8xl font-black bg-gradient-to-br from-purple-400 to-purple-700 bg-clip-text text-transparent">
          404
        </p>
        <p className="text-gray-300 text-xl font-semibold">Page not found</p>
        <p className="text-gray-500 text-sm max-w-sm">
          The URL you tried doesn&apos;t match any page. Maybe a typo, or the page moved.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          🙌 Play Now
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 font-semibold px-6 py-3 rounded-2xl transition-all duration-200"
        >
          🏆 Leaderboard
        </Link>
      </div>
    </main>
  )
}
