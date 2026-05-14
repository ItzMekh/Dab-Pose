'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

interface Props {
  username: string
  avatarUrl?: string | null
}

export default function ProfileCard({ username, avatarUrl }: Props) {
  const [country, setCountry] = useState<string | null>(null)
  const [totalPlays, setTotalPlays] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/profile/${username}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (d.user?.country) setCountry(d.user.country)
        if (typeof d.stats?.totalPlays === 'number') setTotalPlays(d.stats.totalPlays)
      })
      .catch(() => {})
  }, [username])

  const grad = GRAD[username.charCodeAt(0) % GRAD.length]
  const flag = country && country !== 'XX' ? (FLAG[country] ?? '🌍') : null

  return (
    <Link href="/profile/me" className="group block">
      <div className="flex items-center gap-3 bg-black/80 backdrop-blur-sm border border-white/10 hover:border-purple-500/40 rounded-xl px-3 py-2 transition-all duration-200">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-sm shrink-0`}>
            {username[0].toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">{username}</p>
          <p className="text-gray-500 text-xs">
            {flag && <span className="mr-1">{flag}</span>}
            {totalPlays !== null ? `${totalPlays.toLocaleString('en-US')} plays` : '—'}
          </p>
        </div>

        <span className="text-gray-500 group-hover:text-purple-400 text-sm transition-colors shrink-0">
          Profile →
        </span>
      </div>
    </Link>
  )
}
