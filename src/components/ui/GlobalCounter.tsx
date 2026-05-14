'use client'

import { useState, useEffect, useRef } from 'react'
import { useRealtimeVersion } from '@/hooks/useRealtimeVersion'

function formatPlays(n: number): string {
  return n.toLocaleString('en-US')
}

export default function GlobalCounter() {
  const [totalPlays, setTotalPlays] = useState<number | null>(null)
  const fetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const doFetch = () =>
      fetch('/api/stats', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d && typeof d.totalPlays === 'number') setTotalPlays(d.totalPlays) })
        .catch(() => {})
    fetchRef.current = doFetch
    doFetch()
    const id = setInterval(doFetch, 30_000)
    return () => { clearInterval(id); fetchRef.current = null }
  }, [])

  useRealtimeVersion(() => fetchRef.current?.())

  if (totalPlays === null || totalPlays === 0) return null

  return (
    <div className="text-center">
      <p className="text-4xl font-black text-purple-400">{formatPlays(totalPlays)}</p>
      <p className="text-gray-500 text-sm tracking-widest mt-1">DABS WORLDWIDE</p>
    </div>
  )
}
