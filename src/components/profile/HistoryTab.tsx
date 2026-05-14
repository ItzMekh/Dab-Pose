'use client'

import { useState, useEffect, useCallback } from 'react'

interface HistoryItem {
  id: string
  mode: string
  timeMs: number | null
  count: number | null
  country: string
  rankGlobal: number | null
  createdAt: string
}

interface Props {
  username: string
}

type ModeFilter = 'all' | 'single' | 'streak'

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ResultCell({ item }: { item: HistoryItem }) {
  if (item.mode === 'single' && item.timeMs !== null) {
    return (
      <span className="text-white text-sm font-medium">
        ⚡ {item.timeMs}<span className="text-gray-500 text-xs">ms</span>
      </span>
    )
  }
  if (item.mode === 'streak' && item.count !== null) {
    return (
      <span className="text-white text-sm font-medium">
        🔥 {item.count}<span className="text-gray-500 text-xs"> dabs</span>
      </span>
    )
  }
  return <span className="text-gray-500 text-sm">—</span>
}

export default function HistoryTab({ username }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(async (cursor: string | null, replace: boolean) => {
    const params = new URLSearchParams()
    if (mode !== 'all') params.set('mode', mode)
    if (cursor) params.set('cursor', cursor)
    const qs = params.toString()
    const res = await fetch(`/api/profile/${username}/history${qs ? `?${qs}` : ''}`)
    if (!res.ok) return
    const data = await res.json()
    setItems(prev => replace ? data.items : [...prev, ...data.items])
    setNextCursor(data.nextCursor)
  }, [username, mode])

  useEffect(() => {
    setLoading(true)
    fetchPage(null, true).finally(() => setLoading(false))
  }, [fetchPage])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    await fetchPage(nextCursor, false)
    setLoadingMore(false)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-bold">History</h2>
          <p className="text-gray-500 text-sm">All scored games</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['all', 'single', 'streak'] as ModeFilter[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                mode === m ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'single' ? '⚡' : m === 'streak' ? '🔥' : '🎮'} {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/3 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-12">No games yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3"
              >
                <ResultCell item={item} />
                {item.rankGlobal && (
                  <span className="ml-auto text-gray-600 text-xs">
                    #{item.rankGlobal} global
                  </span>
                )}
                <span className="text-gray-600 text-xs shrink-0">{timeAgo(item.createdAt)}</span>
              </div>
            ))}
          </div>
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full text-gray-500 hover:text-white text-sm py-3 transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
