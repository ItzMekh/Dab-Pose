'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useBrowserCompat } from '@/hooks/useBrowserCompat'
import ErrorBoundary from '@/components/ErrorBoundary'
import LandingScreen from '@/components/landing/LandingScreen'
import type { GameMode } from '@/types'

const GameScreen = dynamic(() => import('@/components/game/GameScreen'), {
  loading: () => (
    <div className="text-gray-400 text-base animate-pulse">Loading game…</div>
  ),
  ssr: false,
})

function UnsupportedScreen({ missing }: { missing: string[] }) {
  return (
    <div className="text-center space-y-4 p-8 max-w-md">
      <h1 className="text-3xl font-black text-red-400">Not Supported</h1>
      <p className="text-gray-400">Your browser is missing required features:</p>
      <ul className="text-gray-500 text-sm space-y-1">
        {missing.map(f => <li key={f}>✗ {f}</li>)}
      </ul>
      <p className="text-gray-500 text-xs">Use Chrome 90+ or Edge 90+</p>
    </div>
  )
}

export default function Home() {
  const [started, setStarted] = useState(false)
  const [mode, setMode] = useState<GameMode>('single')
  const compat = useBrowserCompat()

  if (!compat.ok) return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <UnsupportedScreen missing={compat.missing} />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      {started ? (
        <ErrorBoundary>
          <GameScreen mode={mode} onExit={() => setStarted(false)} />
        </ErrorBoundary>
      ) : (
        <LandingScreen onStart={(m) => { setMode(m); setStarted(true) }} />
      )}
    </main>
  )
}
