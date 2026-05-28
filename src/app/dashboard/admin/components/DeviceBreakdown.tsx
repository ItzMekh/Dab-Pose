interface DeviceEntry {
  name: string
  icon: string
  share: number
  color: string
}

interface DeviceBreakdownProps {
  devices: DeviceEntry[]
  browsers: Array<{ name: string; share: number }>
}

export function DeviceBreakdown({ devices, browsers }: DeviceBreakdownProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-3 text-sm font-semibold text-slate-400">📱 Devices</div>
      <div className="flex flex-col gap-2.5">
        {devices.map(d => (
          <div key={d.name}>
            <div className="mb-1 flex justify-between">
              <span className="text-xs text-slate-300">{d.icon} {d.name}</span>
              <span className="text-xs font-semibold" style={{ color: d.color }}>{d.share}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{ width: `${d.share}%`, background: d.color }}
              />
            </div>
          </div>
        ))}
        {devices.length === 0 && (
          <div className="py-2 text-center text-xs text-slate-600">No data</div>
        )}
      </div>
      {browsers.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <div className="mb-2 text-[11px] text-slate-500">Browsers</div>
          <div className="flex flex-wrap gap-1.5">
            {browsers.map(b => (
              <span key={b.name} className="rounded bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                {b.name} {b.share}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
