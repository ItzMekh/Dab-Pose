'use client'

import { useState } from 'react'
import GameScreen from '@/components/game/GameScreen'
import LandingScreen from '@/components/landing/LandingScreen'

export default function Home() {
  const [started, setStarted] = useState(false)

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      {started ? (
        <GameScreen onExit={() => setStarted(false)} />
      ) : (
        <LandingScreen onStart={() => setStarted(true)} />
      )}
    </main>
  )
}
