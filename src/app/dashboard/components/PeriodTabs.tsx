'use client'

import type { Period } from '@/lib/dashboard'

const TABS: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'all', label: 'All Time' },
]

interface PeriodTabsProps {
  active: Period
  onChange: (p: Period) => void
}

export function PeriodTabs({ active, onChange }: PeriodTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-white/5 p-0.5">
      {TABS.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            active === t.value
              ? 'bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
