'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface ModeDonutProps {
  single: number
  streak: number
}

const COLORS = ['#818cf8', '#e879f9']

export function ModeDonut({ single, streak }: ModeDonutProps) {
  const total = single + streak
  const data = [
    { name: 'Reflex Dab', value: single },
    { name: 'Dab Rush', value: streak },
  ]

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 text-sm font-semibold text-slate-400">Mode Split</div>
      <div className="flex items-center gap-6">
        <div className="h-[120px] w-[120px] shrink-0">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-600">
              No data
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: COLORS[i] }}
              />
              <span className="text-sm text-slate-300">{d.name}</span>
              <span className="text-sm font-semibold" style={{ color: COLORS[i] }}>
                {total > 0 ? `${Math.round((d.value / total) * 100)}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
