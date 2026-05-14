'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

interface Props {
  initialUsername: string
}

export default function UsernameSetupModal({ initialUsername }: Props) {
  const { update } = useSession()
  const [username, setUsername] = useState(initialUsername)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!USERNAME_RE.test(username)) {
      setError('3–20 chars, letters / numbers / underscore only')
      return
    }
    setLoading(true)
    const res = await fetch('/api/profile/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'username', value: username }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed')
      setLoading(false)
      return
    }
    await update({ needsUsernameSetup: false })
    setLoading(false)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 w-full max-w-sm space-y-6"
        >
          <div className="space-y-1">
            <h2 className="text-white text-xl font-black">Choose your username</h2>
            <p className="text-gray-500 text-sm">This is how you&apos;ll appear on the leaderboard</p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(null) }}
              placeholder="e.g. dabking99"
              maxLength={20}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !username}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Saving…' : 'Save & continue'}
            </button>
          </form>

          <p className="text-gray-600 text-xs text-center">
            You can change this later in Settings
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
