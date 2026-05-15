'use client'

import { COUNTRIES, findCountry } from '@/lib/countries'

export default function CountryChip({
  country,
  onChange,
}: {
  country: string
  onChange: (code: string) => void
}) {
  const current = findCountry(country)
  return (
    <label className="relative inline-flex items-center cursor-pointer" title="Country for this score">
      <span aria-hidden className="pointer-events-none inline-flex items-center gap-1 bg-white/8 border border-white/15 hover:border-purple-500/50 rounded-lg px-2 py-1 text-sm leading-none text-white transition-colors">
        <span className="text-base">{current.flag}</span>
        <span className="text-gray-400 text-[10px] font-bold tracking-wide">{current.code === 'XX' ? '—' : current.code}</span>
        <svg className="w-2.5 h-2.5 text-gray-400" viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z" /></svg>
      </span>
      <select
        value={country}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Select country"
      >
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.code} className="bg-gray-900 text-white">
            {c.flag} {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
