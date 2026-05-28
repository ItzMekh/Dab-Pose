interface StatCardProps {
  label: string
  value: string
  sub?: string
  color: string
}

export function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: `linear-gradient(135deg, ${color}1f, ${color}0a)`,
        borderColor: `${color}26`,
      }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
