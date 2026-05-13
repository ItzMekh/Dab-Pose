import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Dab Pose',
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
            <span>←</span> Dab Pose
          </Link>
          <Link
            href="/terms"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Terms of Service →
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mt-1">Last updated: May 2026</p>
        </div>

        <section className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5 space-y-2">
          <p className="text-purple-300 font-bold text-lg">🔒 Your camera never leaves your device</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            All pose detection runs entirely in your browser using MediaPipe. No video frames, images, or
            camera data are ever sent to our servers. We cannot see you — the AI model runs locally on your device.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">What we collect</h2>
          <ul className="space-y-2 text-sm leading-relaxed list-disc list-inside">
            <li><strong className="text-white">Scores &amp; usernames</strong> — when you submit a score, your chosen username and result (reaction time or dab count) are stored in our database.</li>
            <li><strong className="text-white">No personal identification</strong> — we do not collect your name, email, IP address (beyond ephemeral rate limiting), or any account information.</li>
            <li><strong className="text-white">Local storage</strong> — your username is saved in your browser&apos;s localStorage so you don&apos;t have to retype it. It stays on your device.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">Camera &amp; pose detection</h2>
          <p className="text-sm leading-relaxed">
            Dab Pose uses your webcam only to detect whether you&apos;re performing a dab pose. The camera feed is
            processed in real time by MediaPipe Holistic running in your browser. No frames are transmitted,
            stored, or analyzed by our servers at any point.
          </p>
          <p className="text-sm leading-relaxed">
            Camera access is requested only when you click &quot;Let&apos;s Go&quot; and is released when you close the game.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">Leaderboard data</h2>
          <p className="text-sm leading-relaxed">
            Scores submitted to the leaderboard are public. Anyone visiting the site can see usernames and scores.
            Do not use your real name as a username if you prefer privacy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">Third-party services</h2>
          <ul className="space-y-2 text-sm leading-relaxed list-disc list-inside">
            <li><strong className="text-white">Upstash Redis</strong> — stores leaderboard scores. Subject to Upstash&apos;s privacy policy.</li>
            <li><strong className="text-white">Vercel</strong> — hosts the application. Subject to Vercel&apos;s privacy policy.</li>
            <li><strong className="text-white">jsDelivr CDN</strong> — serves the MediaPipe WASM model files. No user data is shared.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">Cookies &amp; analytics</h2>
          <p className="text-sm leading-relaxed">
            We do not use cookies or analytics tracking of any kind. There are no ad networks or tracking pixels on this site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">Contact</h2>
          <p className="text-sm leading-relaxed">
            Questions? Open an issue or reach out via the site&apos;s GitHub repository.
          </p>
        </section>

        {/* Footer links */}
        <div className="border-t border-white/10 pt-6 flex gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
          >
            ← Home
          </Link>
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
