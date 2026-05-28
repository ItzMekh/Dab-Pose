'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface BarTrendProps {
  title: string
  data: Array<{ date: string; count: number }>
  color: string
}

export function BarTrend({ title, data, color }: BarTrendProps) {
  const chartData = data.map(d => ({
    ...d,
    label: d.date.slice(5),
  }))

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 text-sm font-semibold text-slate-400">{title}</div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#1e1b2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#f1f5f9' }}
            />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[140px] items-center justify-center text-xs text-slate-600">No data in range</div>
      )}
    </div>
  )
}
