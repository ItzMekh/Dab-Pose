'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { StatCard } from '../components/StatCard'
import { AdminTabs, type AdminTab } from './components/AdminTabs'
import { DateRangePicker } from './components/DateRangePicker'
import { CountryTable } from './components/CountryTable'
import { TopList } from './components/TopList'
import { DeviceBreakdown } from './components/DeviceBreakdown'
import { BarTrend } from './components/BarTrend'
import { UsersTable } from './components/UsersTable'
import { ReactionHistogram } from './components/ReactionHistogram'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function weekAgoStr() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('Overview')
  const [from, setFrom] = useState(weekAgoStr)
  const [to, setTo] = useState(todayStr)

  const [traffic, setTraffic] = useState<Record<string, unknown> | null>(null)
  const [trafficUnavailable, setTrafficUnavailable] = useState(false)
  const [queryData, setQueryData] = useState<Record<string, unknown> | null>(null)
  const [pages, setPages] = useState<Array<{ label: string; value: number }>>([])
  const [referrers, setReferrers] = useState<Array<{ label: string; value: number }>>([])
  const [devices, setDevices] = useState<Array<{ name: string; icon: string; share: number; color: string }>>([])
  const [browsers, setBrowsers] = useState<Array<{ name: string; share: number }>>([])
  const [countries, setCountries] = useState<Array<{ country: string; visitors: number; pageviews: number; plays: number }>>([])

  const fetchTraffic = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/traffic?from=${from}&to=${to}`)
      const json = await res.json()
      if (json.unavailable) { setTrafficUnavailable(true); return }
      setTraffic(json)
      setTrafficUnavailable(false)
    } catch { setTrafficUnavailable(true) }
  }, [from, to])

  const fetchQuery = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/admin/query?from=${from}&to=${to}`)
      if (res.ok) setQueryData(await res.json())
    } catch { /* noop */ }
  }, [from, to])

  const fetchAnalytics = useCallback(async () => {
    const sections = ['pages', 'referrers', 'devices', 'countries'] as const
    const results = await Promise.allSettled(
      sections.map(s => fetch(`/api/dashboard/traffic?section=${s}&from=${from}&to=${to}`).then(r => r.json()))
    )
    if (results[0].status === 'fulfilled') {
      setPages((results[0].value.topPages ?? []).map((p: { key: string; total: number }) => ({ label: p.key, value: p.total })))
    }
    if (results[1].status === 'fulfilled') {
      setReferrers((results[1].value.referrers ?? []).map((r: { key: string; total: number }) => ({ label: r.key, value: r.total })))
    }
    if (results[2].status === 'fulfilled') {
      const devRaw = results[2].value.devices ?? []
      setDevices(devRaw.map((d: { key: string; total: number }, i: number) => ({
        name: d.key, icon: i === 0 ? '📱' : i === 1 ? '💻' : '📋',
        share: d.total, color: ['#4ade80', '#818cf8', '#fbbf24'][i] ?? '#94a3b8',
      })))
      setBrowsers((results[2].value.browsers ?? []).map((b: { key: string; total: number }) => ({ name: b.key, share: b.total })))
    }
    if (results[3].status === 'fulfilled') {
      setCountries((results[3].value.byCountry ?? []).map((c: { key: string; visitors: number; pageviews: number; plays?: number }) => ({
        country: c.key, visitors: c.visitors ?? 0, pageviews: c.pageviews ?? 0, plays: c.plays ?? 0,
      })))
    }
  }, [from, to])

  useEffect(() => {
    fetchTraffic()
    fetchQuery()
    fetchAnalytics()
  }, [fetchTraffic, fetchQuery, fetchAnalytics])

  const q = queryData as { playsPerDay?: Array<{ date: string; count: number }>; signupsPerDay?: Array<{ date: string; count: number }>; reactionTimes?: number[]; totalPlays?: number; newUsers?: number; avgPlaysPerUser?: number } | null

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">🔒 Admin Dashboard</h1>
          <p className="text-sm text-slate-500">admin panel</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          <Link href="/dashboard" className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white">
            ← Public View
          </Link>
        </div>
      </div>

      <AdminTabs active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'Overview' && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Pageviews" value={trafficUnavailable ? '—' : String(traffic?.pageviews ?? '...')} color="#38bdf8" />
              <StatCard label="Visitors" value={trafficUnavailable ? '—' : String(traffic?.visitors ?? '...')} color="#38bdf8" />
              <StatCard label="Total Plays" value={String(q?.totalPlays ?? '...')} color="#818cf8" />
              <StatCard label="New Signups" value={String(q?.newUsers ?? '...')} color="#e879f9" />
            </div>
            {trafficUnavailable && (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-300">
                Traffic data unavailable — configure VERCEL_ACCESS_TOKEN or view in{' '}
                <a href="https://vercel.com" className="underline" target="_blank" rel="noreferrer">Vercel Dashboard</a>
              </div>
            )}
            <CountryTable data={countries} />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <BarTrend title="Plays per Day" data={q?.playsPerDay ?? []} color="#818cf8" />
              <BarTrend title="Signups per Day" data={q?.signupsPerDay ?? []} color="#e879f9" />
            </div>
          </>
        )}

        {tab === 'Analytics' && (
          <div className="grid gap-3 md:grid-cols-3">
            <TopList title="Top Pages" icon="📄" entries={pages} color="#38bdf8" />
            <TopList title="Referrers" icon="🔗" entries={referrers} color="#e879f9" />
            <DeviceBreakdown devices={devices} browsers={browsers} />
          </div>
        )}

        {tab === 'Users' && <UsersTable />}

        {tab === 'Game Stats' && (
          <div className="grid gap-3 md:grid-cols-2">
            <ReactionHistogram data={q?.reactionTimes ?? []} />
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
              <div className="mb-4 text-sm font-semibold text-slate-400">Quick Stats (selected range)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase text-slate-500">Total Plays</div>
                  <div className="text-xl font-bold text-slate-100">{(q?.totalPlays ?? 0).toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase text-slate-500">New Users</div>
                  <div className="text-xl font-bold text-slate-100">{(q?.newUsers ?? 0).toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <div className="text-[10px] uppercase text-slate-500">Avg Plays/User</div>
                  <div className="text-xl font-bold text-slate-100">{q?.avgPlaysPerUser ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
