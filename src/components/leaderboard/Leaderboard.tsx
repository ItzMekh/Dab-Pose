'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Score } from '@/types'

type Tab = 'single' | 'streak'
type Period = 'all' | 'week' | 'today'
const PAGE = 10
const PERIOD_LABELS: Record<Period, string> = { all: 'All Time', week: 'This Week', today: 'Today' }

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('single')
  const [period, setPeriod] = useState<Period>('all')
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(PAGE)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setVisible(PAGE)
    const periodParam = period !== 'all' ? `&period=${period}` : ''
    fetch(`/api/leaderboard?mode=${tab}${periodParam}`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
      .then(data => { setScores(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [tab, period, retry])

  const shown = scores.slice(0, visible)
  const hasMore = visible < scores.length

  return (
    <div className="w-full max-w-lg px-4 sm:px-0 pb-28">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white">Leaderboard</h1>
          <p className="text-gray-400">Fastest dabs worldwide</p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
          {(['single', 'streak'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                tab === t
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'single' ? '⚡ Reflex Dab' : '🔥 Dab Rush'}
            </button>
          ))}
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {(['all', 'week', 'today'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                period === p
                  ? 'bg-white/15 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="bg-white/5 border border-white/10 backdrop-blur-lg rounded-2xl overflow-hidden overflow-x-auto"
          >
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-400 text-sm">
                Failed to load scores.{' '}
                <button onClick={() => setRetry(r => r + 1)} className="underline cursor-pointer">Retry</button>
              </div>
            ) : scores.length === 0 ? (
              <div className="min-h-[200px] flex items-center justify-center text-center text-gray-400">No scores yet. Be the first!</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-sm">
                    <th className="p-4 text-left">#</th>
                    <th className="p-4 text-left">Name</th>
                    {tab === 'single'
                      ? <th className="p-4 text-center">Time (ms)</th>
                      : <th className="p-4 text-center">Dabs / 30s</th>
                    }
                    <th className="p-4 text-right hidden sm:table-cell">Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((score, i) => (
                    <motion.tr
                      key={score.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-yellow-400/5' : ''}`}
                    >
                      <td className="p-4 text-gray-400 font-mono">
                        {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td className="p-4 font-semibold">
                        {i === 0 ? (
                          <span className="text-yellow-300 flex items-center gap-2">
                            <span className="max-w-[120px] sm:max-w-none truncate">{score.username}</span>
                            <span className="text-xs font-normal text-yellow-600 tracking-wide shrink-0">
                              {tab === 'single' ? 'Reflex God' : 'Most Dabs'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-white max-w-[120px] sm:max-w-none truncate block">{score.username}</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-mono text-purple-300 font-bold">
                        {tab === 'single' ? score.time_ms : score.count}
                      </td>
                      <td className="p-4 text-right hidden sm:table-cell text-gray-600 text-xs font-mono">
                        {(() => {
                          const d = new Date(score.created_at)
                          const dd = String(d.getDate()).padStart(2, '0')
                          const mm = String(d.getMonth() + 1).padStart(2, '0')
                          const yyyy = d.getFullYear()
                          const hh = String(d.getHours()).padStart(2, '0')
                          const min = String(d.getMinutes()).padStart(2, '0')
                          return `${dd}/${mm}/${yyyy} ${hh}:${min}`
                        })()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Show More */}
        {hasMore && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setVisible(v => v + PAGE)}
            className="w-full py-3 text-gray-400 hover:text-white text-sm font-semibold border border-white/10 hover:border-white/20 rounded-2xl transition-all cursor-pointer bg-white/3 hover:bg-white/8"
          >
            Show More ({scores.length - visible} remaining)
          </motion.button>
        )}
      </div>

      {/* Floating Play Now */}
      <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-center pointer-events-none">
        <a
          href="/"
          className="pointer-events-auto group flex items-center justify-center gap-3 w-full max-w-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-black text-lg py-4 rounded-2xl transition-all duration-200 shadow-2xl shadow-purple-900/60 hover:shadow-purple-700/60 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
        >
          <span className="text-2xl group-hover:animate-bounce">🙌</span>
          Play Now
          <span className="text-purple-300 font-normal text-sm">→</span>
        </a>
      </div>
    </div>
  )
}
