'use client'

import { motion } from 'framer-motion'
import type { StreakResult } from '@/types'
import { useUsername } from '@/hooks/useUsername'

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
  const rating = getRating(result.count)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-5 p-4 sm:p-6 w-full max-w-sm mx-auto"
    >
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
      </div>

      {/* Name field — saves for next game, no leaderboard submit yet for streak */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Your name (remembered next time)"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onBlur={() => { if (username.trim()) saveUsername(username) }}
          maxLength={20}
          className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-purple-500 transition-colors text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 bg-white/8 hover:bg-white/15 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors text-sm"
        >
          Try Again
        </button>
        <button
          onClick={onExit}
          className="flex-1 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 font-bold py-3 rounded-xl cursor-pointer transition-colors text-sm"
        >
          Home
        </button>
      </div>
    </motion.div>
  )
}
