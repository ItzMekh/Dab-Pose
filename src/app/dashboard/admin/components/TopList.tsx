interface TopListProps {
  title: string
  icon: string
  entries: Array<{ label: string; value: number }>
  color: string
}

export function TopList({ title, icon, entries, color }: TopListProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-3 text-sm font-semibold text-slate-400">{icon} {title}</div>
      <div className="flex flex-col gap-2">
        {entries.map(e => (
          <div key={e.label} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0">
            <span className="text-xs text-slate-300 font-mono">{e.label}</span>
            <span className="text-xs font-semibold" style={{ color }}>
              {e.value.toLocaleString()}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-2 text-center text-xs text-slate-600">No data</div>
        )}
      </div>
    </div>
  )
}
