'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

const FLAG: Record<string, string> = {
  TH: '🇹🇭', US: '🇺🇸', JP: '🇯🇵', GB: '🇬🇧', DE: '🇩🇪',
  FR: '🇫🇷', KR: '🇰🇷', CN: '🇨🇳', AU: '🇦🇺', CA: '🇨🇦',
  BR: '🇧🇷', IN: '🇮🇳', SG: '🇸🇬', MX: '🇲🇽', IT: '🇮🇹',
}

const GRAD = [
  'from-purple-500 to-indigo-500',
  'from-cyan-500 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
]

function shortPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

interface Props {
  username: string
  avatarUrl?: string | null
}

export default function ProfileCard({ username, avatarUrl }: Props) {
  const { update } = useSession()
  const [canonicalUsername, setCanonicalUsername] = useState<string | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [totalPlays, setTotalPlays] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/profile/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) return
        setCanonicalUsername(d.user.username)
        if (d.user.country) setCountry(d.user.country)
        if (typeof d.stats?.totalPlays === 'number') setTotalPlays(d.stats.totalPlays)
        // Sync JWT if DB username drifted from the prop sourced from session
        if (d.user.username !== username) update()
      })
      .catch(() => {})
  }, [username, update])

  const displayName = canonicalUsername ?? username
  const grad = GRAD[displayName.charCodeAt(0) % GRAD.length]
  const flag = country && country !== 'XX' ? (FLAG[country] ?? '🌍') : null

  return (
    <Link href="/profile/me" className="group block">
      <div className="flex flex-col items-center gap-1.5 bg-black/80 backdrop-blur-sm border border-white/10 group-hover:border-purple-500/40 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.15)] rounded-2xl px-3 py-3 w-[88px] transition-all duration-200">
        <div className="relative shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-base`}>
              {displayName[0].toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-black rounded-full" />
        </div>

        <p className="text-white text-xs font-bold truncate w-full text-center leading-tight">
          {displayName}
        </p>

        <p className="text-gray-500 text-[10px] leading-tight text-center">
          {flag && <span className="mr-0.5">{flag}</span>}
          {totalPlays !== null ? `${shortPlays(totalPlays)} plays` : '—'}
        </p>
      </div>
    </Link>
  )
}
