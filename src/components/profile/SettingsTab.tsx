'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { COUNTRIES } from '@/lib/countries'

const RENAME_COOLDOWN_MS = 24 * 60 * 60 * 1000

function formatRemaining(ms: number): string {
  if (ms <= 0) return ''
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

async function patchSetting(field: string, value: string, currentPassword?: string) {
  const body: Record<string, string> = { field, value }
  if (currentPassword) body.currentPassword = currentPassword
  return fetch('/api/profile/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

interface Props {
  username: string
  country: string
  hasPassword: boolean
  usernameChangedAt: string | null
}

export default function SettingsTab({ username: initialUsername, country: initialCountry, hasPassword, usernameChangedAt }: Props) {
  const router = useRouter()
  const { update } = useSession()
  const [username, setUsername] = useState(initialUsername)
  const [country, setCountry] = useState(initialCountry)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [nextChangeAt, setNextChangeAt] = useState<string | null>(
    usernameChangedAt
      ? new Date(new Date(usernameChangedAt).getTime() + RENAME_COOLDOWN_MS).toISOString()
      : null,
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!nextChangeAt) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [nextChangeAt])

  const cooldownRemainingMs = nextChangeAt
    ? new Date(nextChangeAt).getTime() - now
    : 0
  const cooldownActive = cooldownRemainingMs > 0

  function setMessage(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await patchSetting('username', username)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      if (res.status === 429 && data.nextChangeAt) {
        setNextChangeAt(data.nextChangeAt)
      }
      setMessage('err', data.error ?? 'Failed')
      return
    }
    setMessage('ok', 'Username updated')
    setNextChangeAt(new Date(Date.now() + RENAME_COOLDOWN_MS).toISOString())
    await update()
    window.location.href = `/profile/${data.username}?tab=settings`
  }

  async function handleCountryChange(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await patchSetting('country', country.toUpperCase())
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setMessage('err', data.error ?? 'Failed')
    } else {
      setMessage('ok', 'Country updated')
      router.refresh()
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setMessage('err', 'Passwords do not match'); return }
    setLoading(true)
    const res = await patchSetting('password', newPw, currentPw)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setMessage('err', data.error ?? 'Failed')
    } else {
      setMessage('ok', 'Password changed')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
  }

  async function handleDelete() {
    setLoading(true)
    const res = await fetch('/api/profile/settings', { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      await signOut({ callbackUrl: '/' })
    } else {
      setMessage('err', 'Delete failed')
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors'
  const btnClass = 'px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors'

  return (
    <div className="space-y-8 max-w-md">
      <div>
        <h2 className="text-white text-lg font-bold">Settings</h2>
        <p className="text-gray-500 text-sm">Manage your account</p>
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}

      <form onSubmit={handleUsernameChange} className="space-y-3">
        <h3 className="text-white text-sm font-semibold">Change Username</h3>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          disabled={cooldownActive}
          className={`${inputClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        />
        <p className="text-gray-500 text-xs">
          {cooldownActive
            ? `Available in ${formatRemaining(cooldownRemainingMs)}.`
            : 'You can change your username once every 24 hours.'}
        </p>
        <button
          type="submit"
          disabled={loading || cooldownActive || username === initialUsername}
          className={btnClass}
        >
          Save username
        </button>
      </form>

      <form onSubmit={handleCountryChange} className="space-y-3">
        <h3 className="text-white text-sm font-semibold">Change Country</h3>
        <div className="relative">
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className={`${inputClass} appearance-none pr-10 cursor-pointer`}
            aria-label="Country"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code} className="bg-gray-900 text-white">
                {c.flag}  {c.name}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M0 0l5 6 5-6z" />
          </svg>
        </div>
        <button type="submit" disabled={loading || country === initialCountry} className={btnClass}>
          Save country
        </button>
      </form>

      {hasPassword && (
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <h3 className="text-white text-sm font-semibold">Change Password</h3>
          <input type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required className={inputClass} />
          <input type="password" placeholder="New password (min 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} required className={inputClass} />
          <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required className={inputClass} />
          <button type="submit" disabled={loading} className={btnClass}>
            Change password
          </button>
        </form>
      )}

      <div className="border-t border-white/5 pt-6 space-y-3">
        <h3 className="text-red-400 text-sm font-semibold">Danger Zone</h3>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="px-4 py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-bold rounded-lg transition-colors"
          >
            Delete account
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">
              This permanently deletes your account. Leaderboard entries remain as anonymous scores. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors"
              >
                Yes, delete my account
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
