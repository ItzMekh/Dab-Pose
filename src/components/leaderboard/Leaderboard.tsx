'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Score } from '@/types'

export default function Leaderboard() {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => { setScores(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-black text-white">Leaderboard</h1>
        <p className="text-gray-400">Fastest dabs worldwide</p>
      </div>

      <div className="bg-white/5 border border-white/10 backdrop-blur-lg rounded-2xl overflow-hidden">
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
                <th className="p-4 text-right">Time (ms)</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, i) => (
                <motion.tr
                  key={score.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="p-4 text-gray-400 font-mono">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </td>
                  <td className="p-4 text-white font-semibold">{score.username}</td>
                  <td className="p-4 text-right font-mono text-purple-300 font-bold">{score.time_ms}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <a href="/" className="block text-center text-gray-500 hover:text-purple-400 text-sm transition-colors">
        ← Play Now
      </a>
    </div>
  )
}
