import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: false,
})

// ISO week key e.g. "2026-W20"
export function weekKey(): string {
  const d = new Date()
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// UTC date key e.g. "2026-05-14"
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function countryAllKey(): string {
  return 'lb:country:all'
}

export function countryWeekKey(): string {
  return `lb:country:week:${weekKey()}`
}

export function countryTodayKey(): string {
  return `lb:country:today:${todayKey()}`
}
