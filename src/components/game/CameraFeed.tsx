'use client'

import React, { useEffect, useRef, useCallback, useState } from 'react'
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
  resetDetectorRef?: React.MutableRefObject<(() => void) | null>
}

// Pose landmark indices to draw
const LANDMARK_INDICES = [0, 11, 12, 13, 14, 15, 16] // nose, shoulders, elbows, wrists

export default function CameraFeed({ gameState, onDabDetected, onFalseStart, resetDetectorRef }: Props) {
  const { stream, error, ready } = useCamera()
  const fps = useFPS()

  // poseDetected affects render (guide fade) → useState
  const [poseDetected, setPoseDetected] = useState(false)

  // Landscape nudge for mobile portrait users
  const [showLandscapeNudge, setShowLandscapeNudge] = useState(false)
  useEffect(() => {
    const check = () => setShowLandscapeNudge(
      window.innerWidth < 640 && window.innerHeight > window.innerWidth
    )
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const holisticRef = useRef<Awaited<ReturnType<typeof loadHolistic>> | null>(null)
  const detectorRef = useRef(new DabDetector())
  const signalTimeRef = useRef<number | null>(null)
  const gameStateRef = useRef<GameState>(gameState)
  const rafIdRef = useRef<number>(0)
  // Track poseDetected in ref so onResults closure can read it without re-creating
  const poseDetectedRef = useRef(false)

  // Keep ref in sync without triggering effect re-runs
  gameStateRef.current = gameState

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    if (!resetDetectorRef) return
    resetDetectorRef.current = () => detectorRef.current.reset()
    return () => { resetDetectorRef.current = null }
  }, [resetDetectorRef])

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

  // Sync canvas resolution to native video dimensions
  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }, [])

  // Draw landmark dots on canvas
  const drawLandmarks = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; visibility?: number }>,
    width: number,
    height: number,
  ) => {
    for (const idx of LANDMARK_INDICES) {
      const lm = landmarks[idx]
      if (!lm) continue
      if ((lm.visibility ?? 1) < 0.5) continue

      const px = lm.x * width
      const py = lm.y * height

      ctx.beginPath()
      ctx.arc(px, py, 8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.9)'
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [])

  // MediaPipe loop
  const startDetection = useCallback(async () => {
    if (!videoRef.current) return
    try {
      const holistic = await loadHolistic()
      holisticRef.current = holistic

      holistic.onResults((results) => {
        // --- Canvas drawing (always, regardless of game state) ---
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (results.poseLandmarks) {
            drawLandmarks(ctx, results.poseLandmarks, canvas.width, canvas.height)
            // Mark pose as detected (first valid result)
            if (!poseDetectedRef.current) {
              poseDetectedRef.current = true
              setPoseDetected(true)
            }
          }
        }

        // --- Dab detection logic (unchanged) ---
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
  }, [onDabDetected, onFalseStart, drawLandmarks])

  useEffect(() => {
    if (!ready) return
    startDetection()
    return () => {
      cancelAnimationFrame(rafIdRef.current)
      holisticRef.current?.close()
      holisticRef.current = null
      // Clear canvas on unmount
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
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

  // Guide fades out once ready AND pose landmarks first detected
  const guideVisible = !(ready && poseDetected)

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={syncCanvasSize}
        className="w-full h-full object-cover scale-x-[-1]"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none"
      />

      {/* Pose guide overlay — always in DOM, fades out once pose detected */}
      <div
        className={[
          'absolute inset-0 flex flex-col items-center justify-end pb-4 pointer-events-none',
          'transition-opacity duration-1000',
          guideVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-hidden="true"
      >
        {/* SVG stick-figure silhouette — fills the container */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* head */}
          <circle cx="50" cy="18" r="10" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
          {/* body */}
          <line x1="50" y1="28" x2="50" y2="65" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
          {/* left arm */}
          <line x1="50" y1="35" x2="20" y2="52" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
          {/* right arm */}
          <line x1="50" y1="35" x2="80" y2="52" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
          {/* left leg */}
          <line x1="50" y1="65" x2="35" y2="95" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
          {/* right leg */}
          <line x1="50" y1="65" x2="65" y2="95" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
        </svg>

        {/* Label */}
        <span className="relative z-10 text-xs text-gray-400 text-center leading-tight select-none">
          Stand here &bull; Full body in frame
        </span>
      </div>

      {showLandscapeNudge && (
        <div className="absolute top-0 inset-x-0 bg-yellow-900/80 text-yellow-200 text-xs text-center py-2 px-4 z-30">
          Rotate phone to landscape for best experience
        </div>
      )}
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
