'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState, GameResult } from '@/types'
import CameraFeed from './CameraFeed'
import GameTimer from './GameTimer'
import ResultScreen from './ResultScreen'

interface Props {
  onExit: () => void
}

export default function GameScreen({ onExit }: Props) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [result, setResult] = useState<GameResult | null>(null)

  const handleDabDetected = (result: GameResult) => {
    setResult(result)
    setGameState('result')
  }

  if (gameState === 'result' && result) {
    return <ResultScreen result={result} onRetry={() => { setResult(null); setGameState('idle') }} onExit={onExit} />
  }

  return (
    <div className="relative w-full max-w-2xl">
      <CameraFeed gameState={gameState} onDabDetected={handleDabDetected} />
      <GameTimer gameState={gameState} onStateChange={setGameState} />
      <button onClick={onExit} className="absolute top-4 right-4 text-gray-400 hover:text-white text-sm z-10">
        ✕ Exit
      </button>

      <AnimatePresence>
        {gameState === 'false_start' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-900/80 flex items-center justify-center rounded-2xl text-4xl font-black text-red-300"
          >
            TOO EARLY!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
