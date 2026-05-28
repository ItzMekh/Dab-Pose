interface TopScoresProps {
  title: string
  icon: string
  entries: Array<{ username: string; display: string }>
}

export function TopScores({ title, icon, entries }: TopScoresProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-3 text-sm font-semibold text-slate-400">
        {icon} {title}
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((e, i) => (
          <div
            key={e.username}
            className="flex justify-between border-b border-white/[0.04] py-1.5 last:border-0"
          >
            <span className={`text-sm ${i === 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {i === 0 ? '\u{1F451} ' : `#${i + 1} `}{e.username}
            </span>
            <span className={`text-sm ${i === 0 ? 'font-semibold text-green-400' : 'text-slate-300'}`}>
              {e.display}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-2 text-center text-sm text-slate-600">No scores yet</div>
        )}
      </div>
    </div>
  )
}
