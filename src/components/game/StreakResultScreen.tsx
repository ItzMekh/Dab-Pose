'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StreakResult } from '@/types'
import { submitScore, validateUsername, fetchLeaderboard } from '@/lib/api'
import { useUsername } from '@/hooks/useUsername'
import { useStableKeyboardShortcuts } from '@/hooks/useStableKeyboardShortcuts'

interface Props {
  result: StreakResult
  onRetry: () => void
  onExit: () => void
}

function getRating(count: number): { label: string; color: string } {
  if (count >= 20) return { label: 'UNSTOPPABLE', color: 'text-yellow-300' }
  if (count >= 15) return { label: 'ON FIRE',     color: 'text-orange-400' }
  if (count >= 10) return { label: 'SPEEDY',      color: 'text-purple-400' }
  if (count >= 5)  return { label: 'DECENT',      color: 'text-cyan-400'   }
  return              { label: 'KEEP GOING',   color: 'text-gray-400'   }
}

export default function StreakResultScreen({ result, onRetry, onExit }: Props) {
  const { username, setUsername, saveUsername } = useUsername()
  const [validationErr, setValidationErr] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [isKing, setIsKing] = useState(false)

  // Pre-submit rank preview
  const [previewRank, setPreviewRank] = useState<number | null>(null)
  const [isNewRecord, setIsNewRecord] = useState(false)

  const rating = getRating(result.count)

  useEffect(() => {
    fetchLeaderboard('streak')
      .then(scores => {
        const more = scores.filter(s => s.count !== null && s.count > result.count).length
        const rank = more + 1
        setPreviewRank(rank)
        setIsNewRecord(rank === 1)
      })
      .catch(() => { /* rank preview unavailable — silent degradation */ })
  }, [result.count])

  const handleSubmit = async () => {
    const err = validateUsername(username)
    if (err) { setValidationErr(err); return }
    setValidationErr(null)
    setSubmitErr(null)
    setSubmitting(true)
    const res = await submitScore({
      username: username.trim(),
      mode: 'streak',
      count: result.count,
      time_ms: result.best_time_ms ?? undefined,
    })
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

  useStableKeyboardShortcuts({
    Enter: () => { if (!submitted) handleSubmit() },
    Space: onRetry,
    Escape: onExit,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="text-center space-y-5 p-4 sm:p-6 w-full max-w-sm mx-auto"
    >
      {/* NEW RECORD banner — pre-submit */}
      <AnimatePresence>
        {isNewRecord && !submitted && (
          <motion.div
            key="new-record"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 18, delay: 0.15 }}
            className="bg-yellow-400/10 border border-yellow-400/50 rounded-2xl px-4 py-4"
          >
            <motion.p
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              className="text-4xl"
            >
              🏆
            </motion.p>
            <p className="text-yellow-300 font-black text-2xl tracking-wide mt-1">NEW RECORD!</p>
            <p className="text-yellow-600 text-xs mt-0.5">Most dabs in 30 seconds</p>
          </motion.div>
        )}

        {/* King Dab banner — post-submit */}
        {isKing && submitted && (
          <motion.div
            key="king-dab"
            initial={{ opacity: 0, scale: 0.7, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="bg-yellow-400/10 border border-yellow-400/40 rounded-2xl px-4 py-3"
          >
            <p className="text-3xl">🔥</p>
            <p className="text-yellow-300 font-black text-lg tracking-wide">MOST DABS</p>
            <p className="text-yellow-500 text-xs">Most dabs in 30 seconds</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-7 space-y-3">
        <p className={`text-2xl font-black ${rating.color}`}>{rating.label}</p>
        <p className="text-5xl sm:text-6xl font-black text-white tabular-nums">
          {result.count}
          <span className="text-xl text-gray-500 ml-2 font-normal">dabs</span>
        </p>
        <p className="text-gray-500 text-sm">in 30 seconds</p>
        {result.best_time_ms !== null && (
          <p className="text-gray-400 text-xs">Best single: {result.best_time_ms}ms</p>
        )}

        {/* Rank badge — switches from preview to percentile after submit */}
        <AnimatePresence mode="wait">
          {!submitted && previewRank !== null && (
            <motion.div
              key="rank-preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-1"
            >
              <span className="inline-block bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                You would rank #{previewRank}
              </span>
            </motion.div>
          )}
          {submitted && percentile !== null && (
            <motion.div
              key="percentile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-1"
            >
              <span className="inline-block bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                More dabs than {percentile}% of players
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-purple-500 transition-colors text-sm"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl cursor-pointer transition-colors text-sm"
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
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-400 font-semibold text-sm">
          Score saved to leaderboard ✓
        </motion.p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 bg-white/8 hover:bg-white/15 active:scale-95 text-white font-bold py-3 rounded-xl cursor-pointer transition-all text-sm"
        >
          🔄 Try Again
        </button>
        <a
          href="/leaderboard"
          className="flex-1 bg-purple-950/60 hover:bg-purple-900/60 active:scale-95 text-purple-300 font-bold py-3 rounded-xl text-center transition-all text-sm"
        >
          Leaderboard
        </a>
      </div>

      <button
        onClick={onExit}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-sm font-medium cursor-pointer transition-all bg-white/3 hover:bg-white/8"
      >
        🏠 Back to Home
      </button>
    </motion.div>
  )
}
