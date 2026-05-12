'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameResult } from '@/types'
import { submitScore, validateUsername } from '@/lib/api'
import { useUsername } from '@/hooks/useUsername'

interface Props {
  result: GameResult
  onRetry: () => void
  onExit: () => void
}

const RATINGS = [
  { max: 250,      label: 'WORLD CLASS', color: 'text-yellow-300' },
  { max: 400,      label: 'LEGENDARY',   color: 'text-yellow-400' },
  { max: 600,      label: 'INSANE',      color: 'text-purple-400' },
  { max: 800,      label: 'FAST',        color: 'text-cyan-400'   },
  { max: 1200,     label: 'DECENT',      color: 'text-green-400'  },
  { max: Infinity, label: 'SLOW',        color: 'text-gray-400'   },
] as const

function getRating(ms: number) {
  return RATINGS.find(r => ms < r.max) ?? RATINGS[RATINGS.length - 1]
}

export default function ResultScreen({ result, onRetry, onExit }: Props) {
  const { username, setUsername, saveUsername } = useUsername()
  const [validationErr, setValidationErr] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [isKing, setIsKing] = useState(false)
  const rating = getRating(result.time_ms)

  const handleSubmit = async () => {
    const err = validateUsername(username)
    if (err) { setValidationErr(err); return }
    setValidationErr(null)
    setSubmitErr(null)
    setSubmitting(true)
    const res = await submitScore({ username: username.trim(), time_ms: result.time_ms })
    setSubmitting(false)
    if (res.ok) {
      saveUsername(username)
      setPercentile(res.percentile ?? null)
      setIsKing(res.isKing ?? false)
      setSubmitted(true)
    } else {
      setSubmitErr(res.error ?? 'Failed to save score')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="text-center space-y-5 p-4 sm:p-6 w-full max-w-sm mx-auto"
    >
      {/* King Dab banner */}
      <AnimatePresence>
        {isKing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="bg-yellow-400/10 border border-yellow-400/40 rounded-2xl px-4 py-3"
          >
            <p className="text-3xl">👑</p>
            <p className="text-yellow-300 font-black text-lg tracking-wide">KING DAB</p>
            <p className="text-yellow-500 text-xs">You&apos;re the fastest dabber alive</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score card */}
      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-7 space-y-3">
        <p className={`text-2xl font-black tracking-wide ${rating.color}`}>{rating.label}</p>
        <p className="text-5xl sm:text-6xl font-black text-white tabular-nums">
          {result.time_ms}
          <span className="text-xl text-gray-500 ml-2 font-normal">ms</span>
        </p>
        <p className="text-gray-500 text-sm">
          {result.dabArm === 'left' ? 'Left' : 'Right'} arm · {(result.time_ms / 1000).toFixed(3)}s
        </p>

        {/* Percentile badge */}
        <AnimatePresence>
          {percentile !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-1"
            >
              <span className="inline-block bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                Faster than {percentile}% of players
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Submit form */}
      {!submitted ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={e => { setUsername(e.target.value); setValidationErr(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={20}
              className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-purple-500 transition-colors text-sm"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl cursor-pointer transition-colors text-sm"
            >
              {submitting ? '…' : 'Save'}
            </button>
          </div>
          {validationErr && <p className="text-red-400 text-xs text-left">{validationErr}</p>}
          {submitErr && (
            <p className="text-orange-400 text-xs text-left">
              {submitErr} — <button onClick={handleSubmit} className="underline cursor-pointer">retry</button>
            </p>
          )}
        </div>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-green-400 font-semibold text-sm"
        >
          Score saved to leaderboard ✓
        </motion.p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 bg-white/8 hover:bg-white/15 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors text-sm"
        >
          Try Again
        </button>
        <a
          href="/leaderboard"
          className="flex-1 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 font-bold py-3 rounded-xl text-center transition-colors text-sm"
        >
          Leaderboard
        </a>
      </div>

      <button onClick={onExit} className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer transition-colors">
        ← Back to Home
      </button>
    </motion.div>
  )
}
