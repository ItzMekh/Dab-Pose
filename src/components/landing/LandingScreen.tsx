'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Flame } from 'lucide-react'
import type { GameMode } from '@/types'

interface Props {
  onStart: (mode: GameMode) => void
}

const MODES = [
  {
    id: 'single' as GameMode,
    icon: Zap,
    label: 'Single Dab',
    sub: 'Fastest reaction wins',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-400/10',
    accentBorder: 'border-yellow-400/60',
    accentBg: 'bg-yellow-400/8',
  },
  {
    id: 'streak' as GameMode,
    icon: Flame,
    label: 'Streak Mode',
    sub: '30s — dab as many times as you can',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-400/10',
    accentBorder: 'border-orange-400/60',
    accentBg: 'bg-orange-400/8',
  },
] as const

export default function LandingScreen({ onStart }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('single')

  return (
    <div className="text-center space-y-8 p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight">
          <span className="text-white">DAB</span>
          <span className="text-purple-400">SPEED</span>
        </h1>
        <p className="text-gray-400 mt-4 text-base sm:text-xl">How fast can you dab?</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-6 max-w-md mx-auto space-y-3 text-left"
      >
        <h2 className="text-white font-semibold text-lg">How to play</h2>
        <ol className="text-gray-300 space-y-2 list-decimal list-inside text-sm">
          <li>Allow camera access</li>
          <li>Wait for the signal (screen turns green)</li>
          <li>DAB as fast as you can!</li>
          <li>Your reaction time appears in milliseconds</li>
        </ol>
      </motion.div>

      {/* Mode selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
      >
        {MODES.map(({ id, icon: Icon, label, sub, iconColor, iconBg, accentBorder, accentBg }) => {
          const selected = selectedMode === id
          return (
            <motion.button
              key={id}
              onClick={() => setSelectedMode(id)}
              whileTap={{ scale: 0.97 }}
              className={`flex-1 border rounded-2xl px-4 py-4 text-left cursor-pointer transition-all duration-200 ${
                selected
                  ? `${accentBorder} ${accentBg}`
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}
                  animate={selected && id === 'streak'
                    ? { scale: [1, 1.15, 1] }
                    : selected && id === 'single'
                    ? { rotate: [0, 12, -6, 0] }
                    : {}}
                  transition={{ repeat: Infinity, duration: id === 'streak' ? 1.2 : 2, ease: 'easeInOut' }}
                >
                  <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2.5} />
                </motion.div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">{label}</p>
                  {selected && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.25 }}
                      className={`h-0.5 mt-0.5 rounded-full ${id === 'single' ? 'bg-yellow-400' : 'bg-orange-400'}`}
                    />
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-xs">{sub}</p>
            </motion.button>
          )
        })}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onStart(selectedMode)}
        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl px-12 py-4 rounded-2xl neon-pulse cursor-pointer w-full sm:w-auto"
      >
        Let's Go
      </motion.button>

      <a href="/leaderboard" className="block text-gray-500 hover:text-purple-400 text-sm transition-colors">
        View Leaderboard →
      </a>
    </div>
  )
}
