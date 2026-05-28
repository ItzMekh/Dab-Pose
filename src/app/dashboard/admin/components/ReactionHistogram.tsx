'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface ReactionHistogramProps {
  data: number[]
}

const BUCKETS = [
  { min: 100, max: 200, label: '100-200' },
  { min: 200, max: 300, label: '200-300' },
  { min: 300, max: 400, label: '300-400' },
  { min: 400, max: 500, label: '400-500' },
  { min: 500, max: Infinity, label: '500+' },
]

export function ReactionHistogram({ data }: ReactionHistogramProps) {
  const chartData = BUCKETS.map(b => ({
    label: b.label,
    count: data.filter(t => t >= b.min && t < b.max).length,
  }))

  const median = data.length > 0
    ? [...data].sort((a, b) => a - b)[Math.floor(data.length / 2)]
    : null

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 text-sm font-semibold text-slate-400">Reaction Time Distribution</div>
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1e1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {median != null && (
            <div className="mt-2 text-center text-xs text-green-400">median {median}ms</div>
          )}
        </>
      ) : (
        <div className="flex h-[120px] items-center justify-center text-xs text-slate-600">No reaction data in range</div>
      )}
    </div>
  )
}
