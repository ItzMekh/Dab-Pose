'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState } from '@/types'

interface Props {
  gameState: GameState
  onStateChange: (state: GameState) => void
}

export default function GameTimer({ gameState, onStateChange }: Props) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (gameState === 'idle') {
      const t = setTimeout(() => onStateChange('countdown'), 1000)
      return () => clearTimeout(t)
    }
    if (gameState === 'countdown') {
      setCount(3)
      const interval = setInterval(() => {
        setCount(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            const delay = 1000 + Math.random() * 2000
            setTimeout(() => onStateChange('signal'), delay)
            onStateChange('waiting')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [gameState, onStateChange])

  const overlayColor = gameState === 'signal' ? 'bg-green-500/20 border-green-500' : 'bg-purple-500/10 border-purple-500/30'

  return (
    <div className={`absolute inset-0 rounded-2xl border-4 pointer-events-none transition-colors duration-300 ${overlayColor} flex items-center justify-center`}>
      <AnimatePresence mode="wait">
        {gameState === 'countdown' && count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="text-8xl font-black text-white drop-shadow-lg"
          >
            {count}
          </motion.span>
        )}
        {gameState === 'waiting' && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-bold text-gray-300"
          >
            Get Ready...
          </motion.span>
        )}
        {gameState === 'signal' && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-black text-green-400 drop-shadow-lg"
          >
            DAB!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
