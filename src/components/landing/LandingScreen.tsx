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
    label: 'Reflex Dab',
    sub: 'Fastest reaction wins',
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-400/10',
    accentBorder: 'border-yellow-400/60',
    accentBg: 'bg-yellow-400/8',
  },
  {
    id: 'streak' as GameMode,
    icon: Flame,
    label: 'Dab Rush',
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
    <div className="text-center space-y-10 p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-3"
      >
        <h1 className="text-6xl sm:text-8xl font-black tracking-tight leading-none">
          <span className="text-white">DAB</span>
          <span className="text-purple-400"> POSE</span>
        </h1>
        <p className="text-gray-400 text-lg sm:text-2xl font-medium">How fast can you dab?</p>
      </motion.div>

      {/* Mode selector */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto"
      >
        {MODES.map(({ id, icon: Icon, label, sub, iconColor, iconBg, accentBorder, accentBg }) => {
          const selected = selectedMode === id
          return (
            <motion.button
              key={id}
              onClick={() => setSelectedMode(id)}
              whileTap={{ scale: 0.97 }}
              className={`flex-1 border rounded-2xl px-5 py-5 text-left cursor-pointer transition-all duration-200 ${
                selected
                  ? `${accentBorder} ${accentBg}`
                  : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}
                  animate={selected && id === 'streak'
                    ? { scale: [1, 1.15, 1] }
                    : selected && id === 'single'
                    ? { rotate: [0, 12, -6, 0] }
                    : {}}
                  transition={{ repeat: Infinity, duration: id === 'streak' ? 1.2 : 2, ease: 'easeInOut' }}
                >
                  <Icon className={`w-6 h-6 ${iconColor}`} strokeWidth={2.5} />
                </motion.div>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{label}</p>
                  {selected && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.25 }}
                      className={`h-0.5 mt-1 rounded-full ${id === 'single' ? 'bg-yellow-400' : 'bg-orange-400'}`}
                    />
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-sm">{sub}</p>
            </motion.button>
          )
        })}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onStart(selectedMode)}
        className="bg-purple-600 hover:bg-purple-500 text-white font-black text-2xl sm:text-3xl px-16 py-5 rounded-2xl neon-pulse cursor-pointer w-full max-w-lg"
      >
        Let&apos;s Go 🙌
      </motion.button>

      <motion.a
        href="/leaderboard"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-purple-500/40 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all duration-200 cursor-pointer w-full max-w-lg justify-center"
      >
        <span className="text-xl">👑</span>
        <span>Leaderboard</span>
        <span className="text-gray-500 text-sm font-normal">Top Dabbers →</span>
      </motion.a>
    </div>
  )
}
