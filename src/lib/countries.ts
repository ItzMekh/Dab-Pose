export type Country = { code: string; flag: string; name: string }

export const COUNTRIES: Country[] = [
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

export function findCountry(code: string): Country {
  return COUNTRIES.find(c => c.code === code.toUpperCase()) ?? COUNTRIES[0]
}
