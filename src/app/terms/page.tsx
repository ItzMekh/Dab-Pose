import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Dab Pose',
  description: 'Terms of use for Dab Pose.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-300 px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm">← Back to Dab Pose</Link>
          <h1 className="text-3xl font-black text-white mt-4">Terms of Service</h1>
          <p className="text-gray-500 text-sm mt-1">Last updated: May 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">1. Acceptance</h2>
          <p className="text-sm leading-relaxed">
            By using Dab Pose (&quot;the game&quot;, &quot;the site&quot;), you agree to these terms. If you don&apos;t agree, please don&apos;t use the site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">2. Use of the service</h2>
          <p className="text-sm leading-relaxed">Dab Pose is a free browser game. You may use it for personal entertainment. You agree not to:</p>
          <ul className="space-y-2 text-sm leading-relaxed list-disc list-inside">
            <li>Submit false or manipulated scores to the leaderboard</li>
            <li>Attempt to exploit, reverse-engineer, or disrupt the service</li>
            <li>Use automated tools to spam the score submission API</li>
            <li>Submit usernames that are offensive, impersonating, or harmful</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">3. Leaderboard &amp; usernames</h2>
          <p className="text-sm leading-relaxed">
            Scores submitted to the leaderboard are public and permanent. Usernames are limited to 1–20 characters
            (letters, numbers, spaces, underscores, hyphens). We reserve the right to remove scores or usernames
            that violate these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">4. Camera access</h2>
          <p className="text-sm leading-relaxed">
            The game requires webcam access to detect your pose. All processing happens locally in your browser.
            No video is recorded, transmitted, or stored. See our <Link href="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</Link> for details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">5. Disclaimer</h2>
          <p className="text-sm leading-relaxed">
            Dab Pose is provided &quot;as is&quot; without warranties of any kind. We are not responsible for any
            injuries sustained while playing (please dab responsibly), data loss, or service interruptions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">6. Changes</h2>
          <p className="text-sm leading-relaxed">
            We may update these terms at any time. Continued use of the site constitutes acceptance of the updated terms.
          </p>
        </section>

        <div className="border-t border-white/10 pt-6 text-sm text-gray-500 flex gap-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </main>
  )
}
