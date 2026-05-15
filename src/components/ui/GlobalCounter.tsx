'use client'

import { useState, useEffect, useRef } from 'react'
import { useRealtimeVersion } from '@/hooks/useRealtimeVersion'

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export default function GlobalCounter() {
  const [totalPlays, setTotalPlays] = useState<number | null>(null)
  const [totalDabs, setTotalDabs] = useState<number | null>(null)
  const fetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const doFetch = () =>
      fetch('/api/stats', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d) return
          if (typeof d.totalPlays === 'number') setTotalPlays(d.totalPlays)
          if (typeof d.totalDabs === 'number') setTotalDabs(d.totalDabs)
        })
        .catch(() => {})
    fetchRef.current = doFetch
    doFetch()
    const id = setInterval(doFetch, 30_000)
    return () => { clearInterval(id); fetchRef.current = null }
  }, [])

  useRealtimeVersion(() => fetchRef.current?.())

  if (totalPlays === null || totalPlays === 0) return null

  return (
    <p className="flex items-baseline justify-center gap-2 text-gray-500 text-sm tracking-widest">
      <span className="text-purple-400 font-black text-lg">{fmt(totalPlays)}</span>
      <span>
        PLAYS{totalDabs !== null && totalDabs > 0 && <> · {fmt(totalDabs)} DABS</>}
      </span>
    </p>
  )
}
