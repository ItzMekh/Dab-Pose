import Link from 'next/link'
import type { Metadata } from 'next'
import PrivacyContent from '@/components/legal/PrivacyContent'

export const metadata: Metadata = {
  title: 'Dab Pose — Privacy Policy',
  description: 'How Dab Pose handles your data.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-300 px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
          >
            <span>←</span> Home
          </Link>
          <Link
            href="/terms"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Terms of Service →
          </Link>
        </div>

        <PrivacyContent />

        {/* Footer */}
        <div className="border-t border-white/10 pt-6 flex justify-center">
          <Link
            href="/terms"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
          >
            Terms of Service
          </Link>
        </div>

      </div>
    </main>
  )
}
