'use client'

import { useEffect, useRef, useState } from 'react'
import type { CameraError, CameraErrorCode } from '@/types'

const ERROR_MESSAGES: Record<CameraErrorCode, string> = {
  NotAllowedError:  'Camera access denied — click the camera icon in your browser bar',
  NotFoundError:    'No camera found — plug in a webcam and refresh',
  NotReadableError: 'Camera is busy — close other apps using your camera',
  'stream-lost':    'Camera disconnected — check your webcam',
  unknown:          'Camera error — please refresh the page',
}

function classifyError(err: unknown): CameraErrorCode {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'NotAllowedError'
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') return 'NotFoundError'
    if (err.name === 'NotReadableError') return 'NotReadableError'
  }
  return 'unknown'
}

interface UseCameraReturn {
  stream: MediaStream | null
  error: CameraError | null
  ready: boolean
}

export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<CameraError | null>(null)
  const [ready, setReady] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        })
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
        streamRef.current = s

        s.getVideoTracks()[0].addEventListener('ended', () => {
          if (!cancelled) {
            setError({ code: 'stream-lost', message: ERROR_MESSAGES['stream-lost'] })
            setStream(null)
            setReady(false)
          }
        })

        setStream(s)
        setReady(true)
      } catch (err) {
        if (cancelled) return
        const code = classifyError(err)
        setError({ code, message: ERROR_MESSAGES[code] })
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  return { stream, error, ready }
}
