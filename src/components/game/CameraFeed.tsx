'use client'

import { useEffect, useRef, useState } from 'react'
import type { GameState, GameResult } from '@/types'
import { detectDab } from '@/lib/dab-detector'

interface Props {
  gameState: GameState
  onDabDetected: (result: GameResult) => void
}

export default function CameraFeed({ gameState, onDabDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const signalTimeRef = useRef<number | null>(null)
  const holisticRef = useRef<any>(null)

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCameraError('Camera access denied. Please allow camera to play.'))

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (gameState === 'signal') {
      signalTimeRef.current = performance.now()
    }
  }, [gameState])

  if (cameraError) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center text-red-400 text-center p-8">
        {cameraError}
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
        className="absolute inset-0 w-full h-full scale-x-[-1]"
      />
    </div>
  )
}
