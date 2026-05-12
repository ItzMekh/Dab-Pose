'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState } from '@/types'

interface Props {
  gameState: GameState
  onStateChange: (state: GameState) => void
}

export default function GameTimer({ gameState, onStateChange }: Props) {
  const [count, setCount] = useState(3)
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (t1.current) { clearTimeout(t1.current); t1.current = null }
  }, [])

  useEffect(() => {
    clearTimers()

    if (gameState === 'idle') {
      t1.current = setTimeout(() => onStateChange('countdown'), 800)
      return clearTimers
    }

    if (gameState === 'countdown') {
      setCount(3)
      let c = 3
      function tick() {
        c--
        if (c > 0) {
          setCount(c)
          t1.current = setTimeout(tick, 1000)
        } else {
          setCount(0)
          onStateChange('signal')
        }
      }
      t1.current = setTimeout(tick, 1000)
      return clearTimers
    }
  }, [gameState, onStateChange, clearTimers])

  const borderClass =
    gameState === 'signal' ? 'border-green-400 bg-transparent' :
    'border-purple-500/20 bg-transparent'

  return (
    <div
      className={`absolute inset-0 border-4 pointer-events-none transition-colors duration-200 flex items-center justify-center ${borderClass}`}
      style={{ willChange: 'border-color' }}
    >
      <AnimatePresence mode="wait">
        {gameState === 'countdown' && count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-8xl font-black text-white drop-shadow-2xl tabular-nums"
          >
            {count}
          </motion.span>
        )}
        {gameState === 'signal' && (
          <motion.span
            key="signal"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="text-7xl font-black text-green-300 drop-shadow-2xl"
          >
            DAB!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
