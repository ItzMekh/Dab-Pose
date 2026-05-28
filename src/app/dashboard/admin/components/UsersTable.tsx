'use client'

import { useState, useEffect, useCallback } from 'react'

interface UserRow {
  id: string
  username: string
  country: string
  authType: 'google' | 'email'
  plays: number
  bestSingle: number | null
  bestStreak: number | null
  createdAt: string | null
}

export function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('q', search)
    const res = await fetch(`/api/dashboard/admin/users?${params}`)
    if (res.ok) {
      const json = await res.json()
      setUsers(json.users)
      setTotal(json.total)
    }
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-400">👥 Users ({total})</div>
        <input
          type="text"
          placeholder="Search username..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-600"
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-slate-500">
            <th className="px-2 py-2 font-medium">Username</th>
            <th className="px-2 py-2 font-medium">Country</th>
            <th className="px-2 py-2 font-medium">Auth</th>
            <th className="px-2 py-2 text-right font-medium">Plays</th>
            <th className="px-2 py-2 text-right font-medium">Best Single</th>
            <th className="px-2 py-2 text-right font-medium">Best Streak</th>
            <th className="px-2 py-2 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody className="text-slate-300">
          {users.map(u => (
            <tr key={u.id} className="border-b border-white/[0.04]">
              <td className="px-2 py-2">{u.username}</td>
              <td className="px-2 py-2">{u.country}</td>
              <td className="px-2 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${
                  u.authType === 'google'
                    ? 'bg-green-400/15 text-green-400'
                    : 'bg-indigo-400/15 text-indigo-400'
                }`}>
                  {u.authType === 'google' ? 'Google' : 'Email'}
                </span>
              </td>
              <td className="px-2 py-2 text-right">{u.plays}</td>
              <td className="px-2 py-2 text-right text-green-400">
                {u.bestSingle != null ? `${u.bestSingle}ms` : '—'}
              </td>
              <td className="px-2 py-2 text-right text-fuchsia-400">
                {u.bestStreak != null ? String(u.bestStreak) : '—'}
              </td>
              <td className="px-2 py-2 text-slate-500">
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="mt-3 flex justify-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`rounded px-2.5 py-1 text-xs ${
                page === i + 1 ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
