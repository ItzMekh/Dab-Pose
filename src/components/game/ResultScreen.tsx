'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { GameResult } from '@/types'

interface Props {
  result: GameResult
  onRetry: () => void
  onExit: () => void
}

function getRating(ms: number) {
  if (ms < 300) return { label: 'LEGENDARY', color: 'text-yellow-400' }
  if (ms < 500) return { label: 'INSANE', color: 'text-purple-400' }
  if (ms < 700) return { label: 'FAST', color: 'text-cyan-400' }
  if (ms < 1000) return { label: 'DECENT', color: 'text-green-400' }
  return { label: 'SLOW', color: 'text-gray-400' }
}

export default function ResultScreen({ result, onRetry, onExit }: Props) {
  const [username, setUsername] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const rating = getRating(result.time_ms)

  const submit = async () => {
    if (!username.trim() || submitting) return
    setSubmitting(true)
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), time_ms: result.time_ms }),
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6 p-8 max-w-md"
    >
      <div className="bg-white/5 border border-white/10 backdrop-blur-lg rounded-3xl p-8 space-y-4">
        <p className={`text-3xl font-black ${rating.color}`}>{rating.label}</p>
        <p className="text-7xl font-black text-white">{result.time_ms}<span className="text-2xl text-gray-400 ml-2">ms</span></p>
        <p className="text-gray-400">{result.dabArm === 'left' ? 'Left' : 'Right'} arm dab</p>
      </div>

      {!submitted ? (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={20}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50 cursor-pointer"
          >
            Submit
          </button>
        </div>
      ) : (
        <p className="text-green-400 font-semibold">Score saved!</p>
      )}

      <div className="flex gap-3">
        <button onClick={onRetry} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl cursor-pointer">
          Try Again
        </button>
        <a href="/leaderboard" className="flex-1 bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 font-bold py-3 rounded-xl text-center">
          Leaderboard
        </a>
      </div>
    </motion.div>
  )
}
