'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-3 max-w-md">
        <p className="text-7xl">💥</p>
        <p className="text-gray-300 text-xl font-semibold">Something broke</p>
        <p className="text-gray-500 text-sm">
          A page error stopped Dab Pose from rendering this route. Try again, or head back to the landing page.
        </p>
        {error.digest && (
          <p className="text-gray-700 text-xs font-mono pt-2">
            ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          ↻ Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 font-semibold px-6 py-3 rounded-2xl transition-all duration-200"
        >
          ← Home
        </Link>
      </div>
    </main>
  )
}
