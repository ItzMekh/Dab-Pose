'use client'

const COUNTRIES: Array<{ code: string; flag: string; name: string }> = [
  { code: 'XX', flag: '🌍', name: 'Global' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: 'US', flag: '🇺🇸', name: 'USA' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: 'GB', flag: '🇬🇧', name: 'UK' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'KR', flag: '🇰🇷', name: 'Korea' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy' },
]

export default function CountryChip({
  country,
  onChange,
}: {
  country: string
  onChange: (code: string) => void
}) {
  const current = COUNTRIES.find(c => c.code === country) ?? COUNTRIES[0]
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
