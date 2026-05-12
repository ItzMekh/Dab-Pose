export type GameState = 'idle' | 'countdown' | 'waiting' | 'signal' | 'detected' | 'false_start' | 'result'

export interface Score {
  id: string
  username: string
  time_ms: number
  created_at: string
}

export interface GameResult {
  time_ms: number
  dabArm: 'left' | 'right'
}
