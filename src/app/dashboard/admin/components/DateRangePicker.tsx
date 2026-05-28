'use client'

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="text-xs text-slate-400">📅</span>
      <input
        type="date"
        value={from}
        onChange={e => onChange(e.target.value, to)}
        className="bg-transparent text-xs text-slate-200 outline-none"
      />
      <span className="text-xs text-slate-500">→</span>
      <input
        type="date"
        value={to}
        onChange={e => onChange(from, e.target.value)}
        className="bg-transparent text-xs text-slate-200 outline-none"
      />
    </div>
  )
}
