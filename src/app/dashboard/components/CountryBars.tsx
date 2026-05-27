interface CountryBarsProps {
  data: Array<{ country: string; count: number }>
}

export function CountryBars({ data }: CountryBarsProps) {
  const max = data[0]?.count || 1
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-3 text-sm font-semibold text-slate-400">Top Countries</div>
      <div className="flex flex-col gap-2">
        {data.map(d => (
          <div key={d.country} className="flex items-center justify-between">
            <span className="text-sm text-slate-300">{d.country}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-slate-500">
                {d.count.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
