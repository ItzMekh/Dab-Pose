'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameState, GameResult, GameMode, StreakResult } from '@/types'
import { transition } from '@/lib/game-state'
import CameraFeed from './CameraFeed'
import GameTimer from './GameTimer'
import ResultScreen from './ResultScreen'
import StreakHUD from './StreakHUD'
import StreakResultScreen from './StreakResultScreen'
import TutorialOverlay from './TutorialOverlay'

interface Props {
  mode: GameMode
  onExit: () => void
}

export default function GameScreen({ mode, onExit }: Props) {
  const [showTutorial, setShowTutorial] = useState(() =>
    typeof window !== 'undefined' && !localStorage.getItem('dab_seen_intro')
  )
  const [gameState, setGameState] = useState<GameState>('idle')
  const [result, setResult] = useState<GameResult | null>(null)

  // Streak-specific state
  const [streakCount, setStreakCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [streakBest, setStreakBest] = useState<number | null>(null)
  const [streakDone, setStreakDone] = useState(false)
  const [showSwitchArm, setShowSwitchArm] = useState(false)

  const streakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streakStartedRef = useRef(false)
  const lastDabArmRef = useRef<'left' | 'right' | null>(null)
  const switchArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cameraResetRef = useRef<(() => void) | null>(null)

  // Floating +1 animations for streak mode
  const [floatingDabs, setFloatingDabs] = useState<Array<{ id: number }>>([])
  const floatingDabIdRef = useRef(0)
  const floatingDabTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // ESC exits game — disabled during result (result screens handle it themselves)
  useEffect(() => {
    if (gameState === 'result') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, gameState])

  const dismissTutorial = useCallback(() => {
    localStorage.setItem('dab_seen_intro', '1')
    setShowTutorial(false)
  }, [])

  const go = useCallback((to: GameState) => {
    setGameState(prev => transition(prev, to))
  }, [])

  // Start 30s countdown when signal fires for the first time in streak mode
  useEffect(() => {
    if (mode !== 'streak') return
    if (gameState === 'signal' && !streakStartedRef.current) {
      streakStartedRef.current = true
      streakIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (streakIntervalRef.current) {
              clearInterval(streakIntervalRef.current)
              streakIntervalRef.current = null
            }
            setStreakDone(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [gameState, mode])

  // When streak timer hits 0, transition to result
  useEffect(() => {
    if (streakDone) setGameState('result')
  }, [streakDone])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streakIntervalRef.current) clearInterval(streakIntervalRef.current)
      if (switchArmTimerRef.current) clearTimeout(switchArmTimerRef.current)
      floatingDabTimersRef.current.forEach(t => clearTimeout(t))
    }
  }, [])

  const handleDabDetected = useCallback((res: GameResult) => {
    if (mode === 'streak') {
      // Reject same-arm dab — reset detector, show banner, stay in signal (no flash)
      if (lastDabArmRef.current === res.dabArm) {
        if (switchArmTimerRef.current) clearTimeout(switchArmTimerRef.current)
        setShowSwitchArm(true)
        switchArmTimerRef.current = setTimeout(() => setShowSwitchArm(false), 700)
        cameraResetRef.current?.()
        return
      }
      lastDabArmRef.current = res.dabArm
      setStreakCount(c => c + 1)
      setStreakBest(prev => {
        if (prev === null) return res.time_ms
        return res.time_ms < prev ? res.time_ms : prev
      })
      // Floating +1 animation
      const id = ++floatingDabIdRef.current
      setFloatingDabs(prev => [...prev, { id }])
      let tid: ReturnType<typeof setTimeout>
      tid = setTimeout(() => {
        setFloatingDabs(prev => prev.filter(d => d.id !== id))
        floatingDabTimersRef.current.delete(tid)
      }, 850)
      floatingDabTimersRef.current.add(tid)
      go('detected')
      setTimeout(() => go('signal'), 120)
    } else {
      setResult(res)
      go('detected')
      setTimeout(() => go('result'), 200)
    }
  }, [go, mode])

  const handleFalseStart = useCallback(() => {
    if (mode === 'streak') {
      go('false_start')
      setTimeout(() => go('signal'), 1000)
    } else {
      go('false_start')
      setTimeout(() => go('idle'), 2200)
    }
  }, [go, mode])

  const handleRetry = useCallback(() => {
    if (streakIntervalRef.current) {
      clearInterval(streakIntervalRef.current)
      streakIntervalRef.current = null
    }
    streakStartedRef.current = false
    lastDabArmRef.current = null
    setResult(null)
    setStreakCount(0)
    setTimeLeft(30)
    setStreakBest(null)
    setStreakDone(false)
    setShowSwitchArm(false)
    floatingDabTimersRef.current.forEach(t => clearTimeout(t))
    floatingDabTimersRef.current.clear()
    setFloatingDabs([])
    go('idle')
  }, [go])

  // Streak result screen
  if (mode === 'streak' && gameState === 'result') {
    const streakResult: StreakResult = {
      count: streakCount,
      duration_s: 30,
      best_time_ms: streakBest,
    }
    return (
      <div className="fixed inset-0 z-40 bg-[#0a0a0f] flex items-center justify-center overflow-y-auto">
        <StreakResultScreen result={streakResult} onRetry={handleRetry} onExit={onExit} />
      </div>
    )
  }

  // Single mode result screen
  if (mode === 'single' && gameState === 'result' && result) {
    return (
      <div className="fixed inset-0 z-40 bg-[#0a0a0f] flex items-center justify-center overflow-y-auto">
        <ResultScreen result={result} onRetry={handleRetry} onExit={onExit} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {mode === 'streak' && (
        <StreakHUD count={streakCount} timeLeft={timeLeft} />
      )}

      <CameraFeed
        gameState={gameState}
        onDabDetected={handleDabDetected}
        onFalseStart={handleFalseStart}
        resetDetectorRef={cameraResetRef}
      />
      {!showTutorial && <GameTimer gameState={gameState} onStateChange={go} mode={mode} />}

      <button
        onClick={onExit}
        className="absolute top-3 right-3 z-20 text-gray-500 hover:text-white text-lg leading-none bg-black/40 rounded-full w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer"
        aria-label="Exit game"
      >
        ✕
      </button>

      <AnimatePresence>
        {showTutorial && <TutorialOverlay onDismiss={dismissTutorial} />}
      </AnimatePresence>

      {/* Floating +1 for streak mode */}
      <AnimatePresence>
        {floatingDabs.map(d => (
          <motion.div
            key={d.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -120, scale: 1.4 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <span className="text-7xl font-black text-green-300 drop-shadow-2xl select-none">+1</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {showSwitchArm && (
          <motion.div
            key="switch-arm"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-20"
          >
            <div className="bg-yellow-400/20 border border-yellow-400/50 backdrop-blur-sm text-yellow-300 font-black text-lg px-6 py-2.5 rounded-2xl">
              SWITCH ARM! ↔
            </div>
          </motion.div>
        )}
        {!showSwitchArm && gameState === 'false_start' && (
          <motion.div
            key="false-start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center gap-2 pointer-events-none z-10"
          >
            <p className="text-5xl font-black text-red-300">TOO EARLY!</p>
            <p className="text-red-500 text-sm">Wait for the signal</p>
          </motion.div>
        )}
        {gameState === 'detected' && !showSwitchArm && (
          <motion.div
            key="detected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-950/80 flex items-center justify-center pointer-events-none z-10"
          >
            <p className="text-5xl font-black text-green-300">DAB!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
