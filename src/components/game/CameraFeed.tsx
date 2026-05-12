'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { GameState } from '@/types'
import { useCamera } from '@/hooks/useCamera'
import { useFPS } from '@/hooks/useFPS'
import { loadHolistic } from '@/lib/mediapipe'
import { DabDetector } from '@/lib/dab-detector'
import type { GameResult } from '@/types'

interface Props {
  gameState: GameState
  onDabDetected: (result: GameResult) => void
  onFalseStart: () => void
}

export default function CameraFeed({ gameState, onDabDetected, onFalseStart }: Props) {
  const { stream, error, ready } = useCamera()
  const fps = useFPS()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const holisticRef = useRef<Awaited<ReturnType<typeof loadHolistic>> | null>(null)
  const detectorRef = useRef(new DabDetector())
  const signalTimeRef = useRef<number | null>(null)
  const gameStateRef = useRef<GameState>(gameState)
  const rafIdRef = useRef<number>(0)

  // Keep ref in sync without triggering effect re-runs
  gameStateRef.current = gameState

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Track signal time
  useEffect(() => {
    if (gameState === 'signal') {
      signalTimeRef.current = performance.now()
      detectorRef.current.reset()
    }
    if (gameState === 'idle') {
      detectorRef.current.reset()
    }
  }, [gameState])

  // MediaPipe loop
  const startDetection = useCallback(async () => {
    if (!videoRef.current) return
    try {
      const holistic = await loadHolistic()
      holisticRef.current = holistic

      holistic.onResults((results) => {
        if (!results.poseLandmarks) return

        const state = gameStateRef.current
        if (state !== 'signal' && state !== 'waiting') return

        const { confirmed, dabArm } = detectorRef.current.process(results.poseLandmarks)

        if (confirmed) {
          if (state === 'waiting') {
            // Dab before signal = false start
            onFalseStart()
            detectorRef.current.reset()
            return
          }
          if (state === 'signal' && signalTimeRef.current !== null) {
            const time_ms = Math.round(performance.now() - signalTimeRef.current)
            onDabDetected({ time_ms, dabArm: dabArm ?? 'right' })
          }
        }
      })

      async function sendFrame() {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafIdRef.current = requestAnimationFrame(sendFrame)
          return
        }
        await holistic.send({ image: videoRef.current })
        rafIdRef.current = requestAnimationFrame(sendFrame)
      }
      rafIdRef.current = requestAnimationFrame(sendFrame)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[MediaPipe]', err)
    }
  }, [onDabDetected, onFalseStart])

  useEffect(() => {
    if (!ready) return
    startDetection()
    return () => {
      cancelAnimationFrame(rafIdRef.current)
      holisticRef.current?.close()
      holisticRef.current = null
    }
  }, [ready, startDetection])

  if (error) {
    return (
      <div className="w-full aspect-video bg-gray-900/80 border border-red-900/50 rounded-2xl flex flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-3xl">📷</span>
        <p className="text-red-400 font-semibold">{error.message}</p>
        <p className="text-gray-600 text-xs">Error code: {error.code}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none"
      />
      {fps !== null && fps < 15 && (
        <div className="absolute top-3 left-3 bg-yellow-900/80 text-yellow-300 text-xs px-2 py-1 rounded-lg font-mono">
          Low FPS: {fps} — detection may be inaccurate
        </div>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm animate-pulse">
          Starting camera…
        </div>
      )}
    </div>
  )
}
