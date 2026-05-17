import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dab Pose — Terms of Service',
  description: 'Terms of use for Dab Pose.',
}

export default function TermsPage() {
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
            href="/privacy"
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Privacy Policy →
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-black text-white">Terms of Service</h1>
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
          <h2 className="text-white font-bold text-xl">4. Accounts</h2>
          <p className="text-sm leading-relaxed">
            Creating an account is optional — you can submit scores anonymously. If you sign up, you may use email + password or Google sign-in. You can change your username once every 24 hours, change your country at any time, and delete your account from your profile&apos;s Settings tab. See the{' '}
            <Link href="/privacy" className="text-purple-400 hover:text-purple-300 transition-colors">Privacy Policy</Link>
            {' '}for what happens to your leaderboard entries after deletion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">5. Camera access</h2>
          <p className="text-sm leading-relaxed">
            The game requires webcam access to detect your pose. All processing happens locally in your browser.
            No video is recorded, transmitted, or stored. See our{' '}
            <Link href="/privacy" className="text-purple-400 hover:text-purple-300 transition-colors">
              Privacy Policy
            </Link>{' '}
            for details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">6. Disclaimer</h2>
          <p className="text-sm leading-relaxed">
            Dab Pose is provided &quot;as is&quot; without warranties of any kind. We are not responsible for any
            injuries sustained while playing (please dab responsibly), data loss, or service interruptions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-white font-bold text-xl">7. Changes</h2>
          <p className="text-sm leading-relaxed">
            We may update these terms at any time. Continued use of the site constitutes acceptance of the updated terms.
          </p>
        </section>

        {/* Footer */}
        <div className="border-t border-white/10 pt-6 flex justify-center">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
          >
            Privacy Policy
          </Link>
        </div>

      </div>
    </main>
  )
}
