'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState, GameMode } from '@/types'

interface Props {
  gameState: GameState
  onStateChange: (state: GameState) => void
  mode: GameMode
}

export default function GameTimer({ gameState, onStateChange, mode }: Props) {
  const [count, setCount] = useState(3)
  const [showGo, setShowGo] = useState(false)
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t3 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (t1.current) { clearTimeout(t1.current); t1.current = null }
    if (t2.current) { clearTimeout(t2.current); t2.current = null }
    if (t3.current) { clearTimeout(t3.current); t3.current = null }
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
          if (mode === 'single') {
            // Get Ready — random delay 1–3s before signal
            onStateChange('waiting')
          } else {
            onStateChange('signal')
          }
        }
      }
      t1.current = setTimeout(tick, 1000)
      return clearTimers
    }

    if (gameState === 'waiting') {
      setShowGo(false)
      const delay = Math.random() * 2000 + 1000 // 1000–3000ms
      t2.current = setTimeout(() => {
        setShowGo(true)
        onStateChange('signal')
        t3.current = setTimeout(() => setShowGo(false), 400)
      }, delay)
      return clearTimers
    }
  }, [gameState, onStateChange, clearTimers, mode])

  const borderClass =
    gameState === 'signal'  ? 'border-green-400 bg-transparent' :
    gameState === 'waiting' ? 'border-yellow-400/60 bg-transparent' :
    'border-purple-500/20 bg-transparent'

  return (
    <div
      className={`absolute inset-0 border-4 pointer-events-none flex items-center justify-center ${borderClass}`}
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
        {gameState === 'waiting' && (
          <motion.span
            key="waiting"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25 }}
            className="text-4xl font-black text-yellow-300 drop-shadow-2xl"
          >
            Get Ready...
          </motion.span>
        )}
        {gameState === 'signal' && showGo && (
          <motion.span
            key="go"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-8xl font-black text-green-300 drop-shadow-2xl"
          >
            GO!
          </motion.span>
        )}
        {gameState === 'signal' && !showGo && (
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
