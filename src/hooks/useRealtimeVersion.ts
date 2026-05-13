'use client'

import { useEffect, useRef } from 'react'

export function useRealtimeVersion(onUpdate: () => void): void {
  const callbackRef = useRef(onUpdate)
  callbackRef.current = onUpdate

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = () => callbackRef.current()
    return () => es.close()
  }, [])
}
