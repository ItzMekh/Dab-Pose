import type { GameState } from '@/types'

const ALLOWED: Record<GameState, GameState[]> = {
  idle:        ['countdown'],
  countdown:   ['waiting'],
  waiting:     ['signal', 'false_start'],
  signal:      ['detected', 'false_start'],
  detected:    ['result'],
  false_start: ['result', 'idle'],
  result:      ['idle'],
}

export function transition(from: GameState, to: GameState): GameState {
  if (ALLOWED[from].includes(to)) return to
  return from
}

export function isActive(state: GameState): boolean {
  return state !== 'idle' && state !== 'result'
}
