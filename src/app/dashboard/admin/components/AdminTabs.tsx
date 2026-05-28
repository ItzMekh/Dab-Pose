'use client'

const TABS = ['Overview', 'Analytics', 'Users', 'Game Stats'] as const
export type AdminTab = (typeof TABS)[number]

interface AdminTabsProps {
  active: AdminTab
  onChange: (tab: AdminTab) => void
}

export function AdminTabs({ active, onChange }: AdminTabsProps) {
  return (
    <div className="flex gap-0 border-b border-white/[0.06]">
      {TABS.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-sm transition-colors ${
            active === tab
              ? 'border-b-2 border-indigo-400 font-semibold text-indigo-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
