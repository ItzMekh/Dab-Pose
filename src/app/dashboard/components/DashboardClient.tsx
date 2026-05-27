'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardData, Period } from '@/lib/dashboard'
import { StatCard } from './StatCard'
import { PeriodTabs } from './PeriodTabs'
import { CountryBars } from './CountryBars'
import { TopScores } from './TopScores'
import { ModeDonut } from './ModeDonut'

interface Props {
  initial: DashboardData
}

export function DashboardClient({ initial }: Props) {
  const [data, setData] = useState(initial)
  const [period, setPeriod] = useState<Period>(initial.period)

  const refresh = useCallback(async (p: Period) => {
    try {
      const res = await fetch(`/api/dashboard/overview?period=${p}`)
      if (res.ok) setData(await res.json())
    } catch { /* stale data is fine */ }
  }, [])

  useEffect(() => {
    refresh(period)
  }, [period, refresh])

  useEffect(() => {
    const id = setInterval(() => refresh(period), 30_000)
    return () => clearInterval(id)
  }, [period, refresh])

  function changePeriod(p: Period) {
    setPeriod(p)
  }

  const { plays, dabs, playersToday, avgReaction, modeSplit, topCountries, topSingle, topStreak } = data

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Dab Pose Stats
          </h1>
          <p className="text-sm text-slate-500">Live game statistics</p>
        </div>
        <PeriodTabs active={period} onChange={changePeriod} />
      </div>

      {/* Stat Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Plays" value={plays.toLocaleString()} color="#818cf8" />
        <StatCard label="Total Dabs" value={dabs.toLocaleString()} color="#e879f9" />
        <StatCard
          label="Players Today"
          value={playersToday.toLocaleString()}
          sub="unique entries"
          color="#4ade80"
        />
        <StatCard
          label="Avg Reaction"
          value={avgReaction != null ? `${avgReaction}ms` : '—'}
          color="#fbbf24"
        />
      </div>

      {/* Mode Split + Countries */}
      <div className="mb-5 grid gap-3 md:grid-cols-[2fr_1fr]">
        <ModeDonut single={modeSplit.single} streak={modeSplit.streak} />
        <CountryBars data={topCountries} />
      </div>

      {/* Top Scores */}
      <div className="grid gap-3 md:grid-cols-2">
        <TopScores
          title="Fastest Reflex Dab"
          icon="⚡"
          entries={topSingle.map(s => ({ username: s.username, display: `${s.time_ms}ms` }))}
        />
        <TopScores
          title="Top Dab Rush"
          icon="🔥"
          entries={topStreak.map(s => ({ username: s.username, display: `${s.count} dabs` }))}
        />
      </div>
    </div>
  )
}
