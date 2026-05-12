'use client'

import { useEffect, useRef, useState } from 'react'

export function useFPS(sampleIntervalMs = 1000): number | null {
  const [fps, setFps] = useState<number | null>(null)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const rafId = useRef<number>(0)

  useEffect(() => {
    function tick() {
      frameCount.current++
      const now = performance.now()
      const elapsed = now - lastTime.current
      if (elapsed >= sampleIntervalMs) {
        setFps(Math.round((frameCount.current * 1000) / elapsed))
        frameCount.current = 0
        lastTime.current = now
      }
      rafId.current = requestAnimationFrame(tick)
    }
    rafId.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId.current)
  }, [sampleIntervalMs])

  return fps
}
