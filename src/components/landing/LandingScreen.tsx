'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { GameMode } from '@/types'

interface Props {
  onStart: (mode: GameMode) => void
}

export default function LandingScreen({ onStart }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('single')

  return (
    <div className="text-center space-y-8 p-8">
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-7xl font-black tracking-tight">
          <span className="text-white">DAB</span>
          <span className="text-purple-400">SPEED</span>
        </h1>
        <p className="text-gray-400 mt-4 text-xl">How fast can you dab?</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 max-w-md mx-auto space-y-3 text-left"
      >
        <h2 className="text-white font-semibold text-lg">How to play</h2>
        <ol className="text-gray-300 space-y-2 list-decimal list-inside text-sm">
          <li>Allow camera access</li>
          <li>Wait for the signal (screen turns green)</li>
          <li>DAB as fast as you can!</li>
          <li>Your reaction time appears in milliseconds</li>
        </ol>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex gap-3 max-w-md mx-auto"
      >
        <button
          onClick={() => setSelectedMode('single')}
          className={`flex-1 border rounded-2xl px-4 py-4 text-left cursor-pointer transition-colors ${
            selectedMode === 'single'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 bg-white/5 hover:bg-white/8'
          }`}
        >
          <p className="text-white font-bold text-sm">Single Dab</p>
          <p className="text-gray-400 text-xs mt-1">Fastest reaction wins</p>
        </button>
        <button
          onClick={() => setSelectedMode('streak')}
          className={`flex-1 border rounded-2xl px-4 py-4 text-left cursor-pointer transition-colors ${
            selectedMode === 'streak'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 bg-white/5 hover:bg-white/8'
          }`}
        >
          <p className="text-white font-bold text-sm">Streak Mode (30s)</p>
          <p className="text-gray-400 text-xs mt-1">Dab as many times as you can in 30 seconds</p>
        </button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onStart(selectedMode)}
        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl px-12 py-4 rounded-2xl neon-pulse cursor-pointer"
      >
        Let's Go
      </motion.button>

      <a href="/leaderboard" className="block text-gray-500 hover:text-purple-400 text-sm transition-colors">
        View Leaderboard →
      </a>
    </div>
  )
}
