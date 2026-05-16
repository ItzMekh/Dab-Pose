export type GameState =
  | 'idle'
  | 'countdown'
  | 'waiting'
  | 'signal'
  | 'detected'
  | 'false_start'
  | 'result'

export type GameMode = 'single' | 'streak'

export interface StreakResult {
  count: number
  duration_s: number
  best_time_ms: number | null
}

export type CameraErrorCode =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'stream-lost'
  | 'unknown'

export interface CameraError {
  code: CameraErrorCode
  message: string
}

export interface Score {
  id: string
  username: string
  time_ms: number | null
  count: number | null
  mode: 'single' | 'streak'
  created_at: string
  country?: string  // ISO 3166-1 alpha-2 or "XX" for unknown
  userId?: string | null
  verified?: boolean  // true when an account currently exists for this userId
  avatarUrl?: string | null
}

export interface GameResult {
  time_ms: number
  dabArm: 'left' | 'right'
}

export interface CompatResult {
  ok: boolean
  missing: string[]
}
