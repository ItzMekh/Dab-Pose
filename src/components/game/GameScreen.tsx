'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState, GameResult } from '@/types'
import { transition } from '@/lib/game-state'
import CameraFeed from './CameraFeed'
import GameTimer from './GameTimer'
import ResultScreen from './ResultScreen'

interface Props {
  onExit: () => void
}

export default function GameScreen({ onExit }: Props) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [result, setResult] = useState<GameResult | null>(null)

  const go = useCallback((to: GameState) => {
    setGameState(prev => transition(prev, to))
  }, [])

  const handleDabDetected = useCallback((res: GameResult) => {
    setResult(res)
    go('detected')
    // detected → result after brief delay so overlay shows
    setTimeout(() => go('result'), 600)
  }, [go])

  const handleFalseStart = useCallback(() => {
    go('false_start')
    setTimeout(() => go('idle'), 2200)
  }, [go])

  const handleRetry = useCallback(() => {
    setResult(null)
    go('idle')
  }, [go])

  if (gameState === 'result' && result) {
    return <ResultScreen result={result} onRetry={handleRetry} onExit={onExit} />
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <CameraFeed
        gameState={gameState}
        onDabDetected={handleDabDetected}
        onFalseStart={handleFalseStart}
      />
      <GameTimer gameState={gameState} onStateChange={go} />

      <button
        onClick={onExit}
        className="absolute top-3 right-3 z-20 text-gray-500 hover:text-white text-lg leading-none bg-black/40 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
        aria-label="Exit game"
      >
        ✕
      </button>

      <AnimatePresence>
        {gameState === 'false_start' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center rounded-2xl gap-2 pointer-events-none z-10"
          >
            <p className="text-5xl font-black text-red-300">TOO EARLY!</p>
            <p className="text-red-500 text-sm">Wait for the signal</p>
          </motion.div>
        )}
        {gameState === 'detected' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-950/80 flex items-center justify-center rounded-2xl pointer-events-none z-10"
          >
            <p className="text-5xl font-black text-green-300">DAB!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
