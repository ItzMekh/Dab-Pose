'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Score } from '@/types'

type Tab = 'single' | 'streak'

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('single')
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/leaderboard?mode=${tab}`)
      .then(r => r.json())
      .then(data => { setScores(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tab])

  return (
    <div className="w-full max-w-lg space-y-6 px-4 sm:px-0">
      <div className="text-center">
        <h1 className="text-4xl font-black text-white">Leaderboard</h1>
        <p className="text-gray-400">Fastest dabs worldwide</p>
      </div>

      {/* Tab switcher */}
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
          ) : scores.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No scores yet. Be the first!</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-sm">
                  <th className="p-4 text-left">#</th>
                  <th className="p-4 text-left">Name</th>
                  {tab === 'single'
                    ? <th className="p-4 text-right">Time (ms)</th>
                    : <th className="p-4 text-right">Dabs / 30s</th>
                  }
                  <th className="p-4 text-right hidden sm:table-cell">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, i) => (
                  <motion.tr
                    key={score.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-yellow-400/5' : ''}`}
                  >
                    <td className="p-4 text-gray-400 font-mono">
                      {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="p-4 font-semibold">
                      {i === 0 ? (
                        <span className="text-yellow-300">
                          {score.username}
                          <span className="ml-2 text-xs font-normal text-yellow-600 tracking-wide">King Dab</span>
                        </span>
                      ) : (
                        <span className="text-white">{score.username}</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono text-purple-300 font-bold">
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

      <a href="/" className="block text-center text-gray-500 hover:text-purple-400 text-sm transition-colors">
        ← Play Now
      </a>
    </div>
  )
}
