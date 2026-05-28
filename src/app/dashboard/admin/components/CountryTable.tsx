'use client'

interface CountryRow {
  country: string
  visitors: number
  pageviews: number
  plays: number
}

interface CountryTableProps {
  data: CountryRow[]
}

export function CountryTable({ data }: CountryTableProps) {
  const maxVisitors = data[0]?.visitors || 1
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="mb-4 text-sm font-semibold text-slate-400">🌍 Visitors by Country</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-slate-500">
            <th className="px-2 py-2 font-medium">Country</th>
            <th className="px-2 py-2 text-right font-medium">Visitors</th>
            <th className="px-2 py-2 text-right font-medium">Pageviews</th>
            <th className="px-2 py-2 text-right font-medium">Plays</th>
            <th className="px-2 py-2 text-right font-medium">Play Rate</th>
            <th className="w-32 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody className="text-slate-300">
          {data.map(row => {
            const rate = row.visitors > 0 ? Math.round((row.plays / row.visitors) * 100) : 0
            return (
              <tr key={row.country} className="border-b border-white/[0.04]">
                <td className="px-2 py-2">{row.country}</td>
                <td className="px-2 py-2 text-right font-semibold">{row.visitors.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{row.pageviews.toLocaleString()}</td>
                <td className="px-2 py-2 text-right text-indigo-400">{row.plays.toLocaleString()}</td>
                <td className="px-2 py-2 text-right text-green-400">{rate}%</td>
                <td className="px-2 py-2">
                  <div className="h-1.5 rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400"
                      style={{ width: `${(row.visitors / maxVisitors) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="py-4 text-center text-xs text-slate-600">No data in range</div>
      )}
    </div>
  )
}
