'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { RotateCcw, Home, Flame, Crown, Trophy, Calendar, Sparkles } from 'lucide-react'
import type { StreakResult } from '@/types'
import { submitScore, validateUsername, fetchRankPreview, type RankTriple } from '@/lib/api'
import { useUsername } from '@/hooks/useUsername'
import { useStableKeyboardShortcuts } from '@/hooks/useStableKeyboardShortcuts'
import { useCountry } from '@/hooks/useCountry'
import CountryChip from './CountryChip'

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

interface RankRowProps {
  icon: ReactNode
  label: string
  rank: number | null
  highlight?: boolean
}

function RankRow({ icon, label, rank, highlight }: RankRowProps) {
  const isOne = rank === 1
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${highlight && isOne ? 'bg-orange-400/8' : ''}`}>
      <span className="flex items-center gap-2 text-gray-300 uppercase tracking-wider text-[11px] font-semibold">
        {icon}
        {label}
      </span>
      <span className={`tabular-nums font-black text-base ${isOne ? 'text-orange-200' : 'text-white'}`}>
        {rank === null ? '—' : isOne ? <>#1 <span className="text-xs">🔥</span></> : `#${rank}`}
      </span>
    </div>
  )
}

export default function StreakResultScreen({ result, onRetry, onExit }: Props) {
  const { username, setUsername, saveUsername } = useUsername()
  const { data: session } = useSession()
  const sessionName = session?.user?.name ?? null
  const [canonicalName, setCanonicalName] = useState<string | null>(null)
  const effectiveName = canonicalName ?? sessionName ?? username
  const [country, setCountry] = useCountry()
  const [validationErr, setValidationErr] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [isKing, setIsKing] = useState(false)

  // Rank preview (pre-submit) + post-submit ranks (from /api/score)
  const [previewRanks, setPreviewRanks] = useState<RankTriple | null>(null)
  const [postRanks, setPostRanks] = useState<RankTriple | null>(null)
  const [isNewRecord, setIsNewRecord] = useState(false)

  const rating = getRating(result.count)
  const showRankOneBanner = (isNewRecord && !submitted) || (isKing && submitted)
  const ranks = submitted ? postRanks : previewRanks

  useEffect(() => {
    fetchRankPreview('streak', result.count)
      .then(r => {
        setPreviewRanks(r)
        setIsNewRecord(r.all === 1)
      })
      .catch(() => { /* rank preview unavailable — silent degradation */ })
  }, [result.count])

  useEffect(() => {
    if (!sessionName) return
    fetch('/api/profile/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) return
        setCanonicalName(d.user.username)
        if (d.user.country && d.user.country !== 'XX') setCountry(d.user.country)
      })
      .catch(() => {})
  }, [sessionName, setCountry])

  const handleSubmit = async () => {
    const nameToSubmit = effectiveName
    if (!sessionName) {
      const err = validateUsername(nameToSubmit)
      if (err) { setValidationErr(err); return }
    }
    setValidationErr(null)
    setSubmitErr(null)
    setSubmitting(true)
    const res = await submitScore({
      username: nameToSubmit.trim(),
      mode: 'streak',
      count: result.count,
      time_ms: result.best_time_ms ?? undefined,
      country,
    })
    setSubmitting(false)
    if (res.ok) {
      if (!sessionName) saveUsername(nameToSubmit)
      setPercentile(res.percentile ?? null)
      setIsKing(res.isKing ?? false)
      setPostRanks({
        all: res.allRank ?? null,
        week: res.weekRank ?? null,
        today: res.todayRank ?? null,
      })
      setSubmitted(true)
    } else {
      setSubmitErr(res.error ?? 'Failed to save score')
    }
  }

  const initialUsernameRef = useRef(username)
  const autoSubmitRef = useRef(false)
  useEffect(() => {
    if (autoSubmitRef.current || submitting || submitted) return
    if (sessionName) {
      autoSubmitRef.current = true
      handleSubmit()
    } else if (initialUsernameRef.current && validateUsername(initialUsernameRef.current) === null) {
      autoSubmitRef.current = true
      handleSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionName, submitting, submitted])

  useStableKeyboardShortcuts({
    Enter: () => { if (!submitted && !submitting) handleSubmit() },
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
      {/* Unified #1 banner — content swaps pre/post submit, container persists */}
      <AnimatePresence>
        {showRankOneBanner && (
          <motion.div
            key="rank-one-banner"
            initial={{ scale: 0.85, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="relative bg-orange-400/10 border border-orange-400/40 rounded-2xl px-4 py-4 overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              {!submitted ? (
                <motion.div
                  key="banner-pre"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.18, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                    className="text-orange-300"
                  >
                    <Flame className="w-9 h-9" strokeWidth={2.5} />
                  </motion.div>
                  <p className="text-orange-200 font-black text-2xl tracking-wide mt-2">NEW RECORD!</p>
                  <p className="text-orange-400/90 text-xs mt-1">Saving your #1 streak…</p>
                </motion.div>
              ) : (
                <motion.div
                  key="banner-post"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col items-center"
                >
                  <Crown className="w-8 h-8 text-orange-200" strokeWidth={2.5} />
                  <p className="text-orange-200 font-black text-xl tracking-wide mt-2">MOST DABS</p>
                  <p className="text-orange-400 text-xs mt-1">You hold #1 on the leaderboard</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 space-y-3">
        <p className={`text-2xl font-black ${rating.color}`}>{rating.label}</p>
        <p className="text-5xl sm:text-6xl font-black text-white tabular-nums">
          {result.count}
          <span className="text-xl text-gray-500 ml-2 font-normal">dabs</span>
        </p>
        <p className="text-gray-500 text-sm">in 30 seconds</p>
        {result.best_time_ms !== null && (
          <p className="text-gray-400 text-xs">Best single: {result.best_time_ms}ms</p>
        )}

        {(percentile !== null || ranks) && (
          <p className="text-orange-300 text-xs font-semibold pt-1">
            {percentile !== null
              ? <>More dabs than <span className="tabular-nums text-orange-200">{percentile}%</span> of players</>
              : <>Calculating rank…</>}
          </p>
        )}
      </div>

      {/* Rank breakdown — All Time / This Week / Today */}
      <AnimatePresence>
        {ranks && (
          <motion.div
            key="ranks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden text-sm"
          >
            <RankRow icon={<Trophy className="w-4 h-4 text-yellow-300" strokeWidth={2.5} />} label="All Time" rank={ranks.all} />
            <RankRow icon={<Calendar className="w-4 h-4 text-cyan-300" strokeWidth={2.5} />} label="This Week" rank={ranks.week} />
            <RankRow icon={<Sparkles className="w-4 h-4 text-orange-200" strokeWidth={2.5} />} label="Today" rank={ranks.today} highlight />
          </motion.div>
        )}
      </AnimatePresence>

      {submitted ? (
        !showRankOneBanner && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-400 font-semibold text-sm">
            Score saved to leaderboard ✓
          </motion.p>
        )
      ) : !sessionName && !submitting && !autoSubmitRef.current ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-xl pl-4 pr-2 py-1 focus-within:border-purple-500 transition-colors">
            <input
              type="text"
              placeholder="Your name to save score"
              value={username}
              autoFocus
              onChange={e => { setUsername(e.target.value); setValidationErr(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={20}
              className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-sm py-1.5 min-w-0"
            />
            <CountryChip country={country} onChange={setCountry} />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!username.trim()}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            Save to leaderboard
          </button>
          {validationErr && <p className="text-red-400 text-xs text-left">{validationErr}</p>}
        </div>
      ) : submitErr ? (
        <p className="text-orange-400 text-sm">
          {submitErr} — <button onClick={handleSubmit} className="underline cursor-pointer">retry</button>
        </p>
      ) : (
        !showRankOneBanner && (
          <p className="text-gray-400 text-sm flex items-center justify-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Saving as <span className="text-white font-semibold">{effectiveName}</span>…
          </p>
        )
      )}

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 active:scale-95 text-white font-bold py-3 rounded-xl cursor-pointer transition-all text-sm"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
          Try Again
        </button>
        <a
          href="/leaderboard"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-purple-950/60 hover:bg-purple-900/60 active:scale-95 text-purple-300 font-bold py-3 rounded-xl text-center transition-all text-sm"
        >
          <Crown className="w-4 h-4" strokeWidth={2.5} />
          Leaderboard
        </a>
      </div>

      <button
        onClick={onExit}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-sm font-medium cursor-pointer transition-all bg-white/3 hover:bg-white/8"
      >
        <Home className="w-4 h-4" strokeWidth={2.5} />
        Back to Home
      </button>
    </motion.div>
  )
}
