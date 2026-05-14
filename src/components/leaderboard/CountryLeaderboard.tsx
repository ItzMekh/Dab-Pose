'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRealtimeVersion } from '@/hooks/useRealtimeVersion'

interface CountryEntry {
  country: string
  totalDabs: number
}

type Period = 'all' | 'week' | 'today'

const PERIOD_LABELS: Record<Period, string> = { all: 'All Time', week: 'This Week', today: 'Today' }

const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina',
  AU: 'Australia', AT: 'Austria', BE: 'Belgium', BR: 'Brazil',
  BG: 'Bulgaria', CA: 'Canada', CL: 'Chile', CN: 'China',
  CO: 'Colombia', HR: 'Croatia', CZ: 'Czechia', DK: 'Denmark',
  EG: 'Egypt', FI: 'Finland', FR: 'France', DE: 'Germany',
  GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary', IN: 'India',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IT: 'Italy',
  JP: 'Japan', KZ: 'Kazakhstan', KE: 'Kenya', KR: 'South Korea',
  MY: 'Malaysia', MX: 'Mexico', MA: 'Morocco', NL: 'Netherlands',
  NZ: 'New Zealand', NG: 'Nigeria', NO: 'Norway', PK: 'Pakistan',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal',
  RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia', SG: 'Singapore',
  ZA: 'South Africa', ES: 'Spain', SE: 'Sweden', CH: 'Switzerland',
  TW: 'Taiwan', TH: 'Thailand', TR: 'Turkey', UA: 'Ukraine',
  GB: 'United Kingdom', US: 'United States', VN: 'Vietnam',
  XX: 'Global',
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2 || code === 'XX') return '🌍'
  return Array.from(code.toUpperCase())
    .map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6))
    .join('')
}

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

interface Props {
  detectedCountry: string
}

export default function CountryLeaderboard({ detectedCountry }: Props) {
  const [entries, setEntries] = useState<CountryEntry[]>([])
  const [period, setPeriod] = useState<Period>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const fetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const periodParam = period !== 'all' ? `&period=${period}` : ''
    const url = `/api/leaderboard?mode=country${periodParam}`

    const doFetch = (fresh: boolean, noStore = false) => {
      if (fresh) { setLoading(true); setError(false) }
      fetch(url, (fresh || noStore) ? { cache: 'no-store' } : {})
        .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
        .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false) })
        .catch(() => { if (fresh) { setError(true); setLoading(false) } })
    }

    fetchRef.current = () => doFetch(false, true)
    doFetch(true)
    const interval = setInterval(() => doFetch(false), 30_000)
    return () => { clearInterval(interval); fetchRef.current = null }
  }, [period])

  useRealtimeVersion(() => fetchRef.current?.())

  const total = entries.reduce((sum, e) => sum + e.totalDabs, 0)
  const myIdx = entries.findIndex(e => e.country === detectedCountry)
  const myEntry = myIdx >= 0 ? entries[myIdx] : null

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
        {(['all', 'week', 'today'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load.</div>
        ) : entries.length === 0 ? (
          <div className="min-h-[200px] flex items-center justify-center text-gray-400">No dabs yet. Be first!</div>
        ) : (
          <div className="divide-y divide-white/5">
            {entries.map((entry, i) => {
              const pct = total > 0 ? (entry.totalDabs / total) * 100 : 0
              const isFirst = i === 0
              return (
                <motion.div
                  key={entry.country}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`px-4 py-3 ${isFirst ? 'bg-purple-500/10' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gray-400 font-mono text-sm w-6 text-center">
                      {isFirst ? '👑' : `#${i + 1}`}
                    </span>
                    <span className="text-xl leading-none">{countryFlag(entry.country)}</span>
                    <span className={`flex-1 font-semibold text-sm ${isFirst ? 'text-purple-300' : 'text-white'}`}>
                      {countryName(entry.country)}
                    </span>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${isFirst ? 'text-purple-300' : 'text-gray-300'}`}>
                        {pct.toFixed(1)}%
                      </p>
                      <p className="text-gray-500 text-xs">{entry.totalDabs.toLocaleString()} dabs</p>
                    </div>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.03 }}
                      className={`h-full rounded-full ${isFirst ? 'bg-gradient-to-r from-purple-500 to-purple-400' : 'bg-white/25'}`}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Your country pill */}
      {myEntry && detectedCountry !== 'XX' && (
        <p className="text-center text-xs text-gray-500">
          {'Dabbing for '}
          <span className="text-purple-400 font-semibold">
            {countryFlag(detectedCountry)} {countryName(detectedCountry)}
            {' — '}#{myIdx + 1}
            {total > 0 && ` · ${((myEntry.totalDabs / total) * 100).toFixed(1)}% of all dabs`}
          </span>
          {myIdx === 0 && ' 👑'}
        </p>
      )}
    </div>
  )
}
