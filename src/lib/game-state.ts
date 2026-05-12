import type { GameState } from '@/types'

const ALLOWED: Record<GameState, GameState[]> = {
  idle:        ['countdown'],
  countdown:   ['signal'],
  waiting:     ['signal', 'false_start'],
  signal:      ['detected', 'false_start'],
  detected:    ['result', 'signal'],
  false_start: ['result', 'idle', 'signal'],
  result:      ['idle'],
}

export function transition(from: GameState, to: GameState): GameState {
  if (ALLOWED[from].includes(to)) return to
  return from
}

export function isActive(state: GameState): boolean {
  return state !== 'idle' && state !== 'result'
}
