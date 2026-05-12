'use client'

import type { Holistic } from '@mediapipe/holistic'

const LOAD_TIMEOUT_MS = 12000
const MAX_RETRIES = 3

export async function loadHolistic(): Promise<Holistic> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const loaded = await Promise.race([
        _loadHolisticInner(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('load-timeout')), LOAD_TIMEOUT_MS)
        ),
      ])
      return loaded
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (lastError.message === 'load-timeout') throw lastError
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)))
    }
  }
  throw lastError ?? new Error('MediaPipe failed to load')
}

async function _loadHolisticInner(): Promise<Holistic> {
  const { Holistic } = await import('@mediapipe/holistic')
  const holistic = new Holistic({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
  })
  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
  return holistic
}
