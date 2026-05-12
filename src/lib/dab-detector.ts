import type { NormalizedLandmarkList } from '@mediapipe/holistic'

export interface DabResult {
  isDab: boolean
  confidence: number
  dabArm: 'left' | 'right' | null
}

function angle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const mag = Math.sqrt((ab.x ** 2 + ab.y ** 2) * (cb.x ** 2 + cb.y ** 2))
  return Math.acos(Math.min(Math.max(dot / mag, -1), 1)) * (180 / Math.PI)
}

export function detectDab(landmarks: NormalizedLandmarkList): DabResult {
  const nose = landmarks[0]
  const lShoulder = landmarks[11], lElbow = landmarks[13], lWrist = landmarks[15]
  const rShoulder = landmarks[12], rElbow = landmarks[14], rWrist = landmarks[16]

  const lElbowAngle = angle(lShoulder, lElbow, lWrist)
  const rElbowAngle = angle(rShoulder, rElbow, rWrist)

  const lWristRaised = lWrist.y < lShoulder.y
  const rWristRaised = rWrist.y < rShoulder.y

  const lFaceDistance = Math.hypot(lWrist.x - nose.x, lWrist.y - nose.y)
  const rFaceDistance = Math.hypot(rWrist.x - nose.x, rWrist.y - nose.y)

  // Dab: one arm raised straight, other arm bent into face
  const leftDab = rWristRaised && rElbowAngle > 140 && lElbowAngle < 100 && lFaceDistance < 0.15
  const rightDab = lWristRaised && lElbowAngle > 140 && rElbowAngle < 100 && rFaceDistance < 0.15

  if (leftDab) return { isDab: true, confidence: 0.9, dabArm: 'left' }
  if (rightDab) return { isDab: true, confidence: 0.9, dabArm: 'right' }
  return { isDab: false, confidence: 0, dabArm: null }
}
