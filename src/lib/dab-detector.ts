import type { NormalizedLandmarkList } from '@mediapipe/holistic'
import type { GameResult } from '@/types'

const DAB_CONFIRM_FRAMES = 3
const STRAIGHT_ELBOW_MIN = 140
const BENT_ELBOW_MAX = 100
const FACE_DISTANCE_MAX = 0.15
const MIN_VISIBILITY = 0.5

export interface DabResult {
  isDab: boolean
  dabArm: 'left' | 'right' | null
}

function angle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2) * (cb.x ** 2 + cb.y ** 2))
  if (mag === 0) return 0
  return Math.acos(Math.min(Math.max(dot / mag, -1), 1)) * (180 / Math.PI)
}

function visible(lm: { visibility?: number }): boolean {
  return (lm.visibility ?? 1) >= MIN_VISIBILITY
}

function rawDetect(landmarks: NormalizedLandmarkList): DabResult {
  const nose = landmarks[0]
  const lS = landmarks[11], lE = landmarks[13], lW = landmarks[15]
  const rS = landmarks[12], rE = landmarks[14], rW = landmarks[16]

  if (![nose, lS, lE, lW, rS, rE, rW].every(visible)) {
    return { isDab: false, dabArm: null }
  }

  const lAngle = angle(lS, lE, lW)
  const rAngle = angle(rS, rE, rW)
  const lRaised = lW.y < lS.y
  const rRaised = rW.y < rS.y
  const lFaceDist = Math.hypot(lW.x - nose.x, lW.y - nose.y)
  const rFaceDist = Math.hypot(rW.x - nose.x, rW.y - nose.y)

  const leftDab =
    rRaised && rAngle > STRAIGHT_ELBOW_MIN &&
    lAngle < BENT_ELBOW_MAX && lFaceDist < FACE_DISTANCE_MAX
  const rightDab =
    lRaised && lAngle > STRAIGHT_ELBOW_MIN &&
    rAngle < BENT_ELBOW_MAX && rFaceDist < FACE_DISTANCE_MAX

  if (leftDab) return { isDab: true, dabArm: 'left' }
  if (rightDab) return { isDab: true, dabArm: 'right' }
  return { isDab: false, dabArm: null }
}

export class DabDetector {
  private count = 0
  private lastArm: 'left' | 'right' | null = null

  process(landmarks: NormalizedLandmarkList): DabResult & { confirmed: boolean } {
    const raw = rawDetect(landmarks)
    if (raw.isDab) {
      this.count++
      this.lastArm = raw.dabArm
    } else {
      this.count = 0
      this.lastArm = null
    }
    return {
      ...raw,
      confirmed: this.count >= DAB_CONFIRM_FRAMES,
      dabArm: this.lastArm,
    }
  }

  reset(): void {
    this.count = 0
    this.lastArm = null
  }

  toGameResult(time_ms: number): GameResult {
    return { time_ms, dabArm: this.lastArm ?? 'right' }
  }
}
