import { FORMATION, LOOK, SPAWN_DIST, VIEW_W } from './config'
import { formationHalf } from './rules'

export interface Projected {
  x: number
  y: number
  scale: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** dist 0 が隊長の足もと、正が奥。画面の y は下が手前。 */
export function project(lane: number, dist: number): Projected {
  const curve = dist <= 0 ? (dist / SPAWN_DIST) * LOOK.behind : Math.pow(Math.min(dist / SPAWN_DIST, 1.25), LOOK.curve)
  const y = LOOK.captainY + (LOOK.horizonY - LOOK.captainY) * curve
  const widthT = Math.min(1, Math.max(0, (curve + 0.22) / 1.22))
  const half = lerp(LOOK.halfNear, LOOK.halfFar, widthT)
  const scaleT = Math.min(1, Math.max(0, curve))
  const scale = dist <= 0 ? LOOK.scaleNear * (1 - dist * 0.0035) : lerp(LOOK.scaleNear, LOOK.scaleFar, scaleT)
  return {
    x: VIEW_W / 2 + lane * half,
    y,
    scale,
  }
}

export function beanOffsets(dogs: number, spread: number): { lane: number; dist: number }[] {
  const count = Math.min(FORMATION.showMax, Math.max(0, Math.floor(dogs)))
  const half = formationHalf(Math.max(dogs, 1)) * spread
  const slots: { lane: number; dist: number }[] = []
  let left = count
  let row = 0
  while (left > 0) {
    const rowCount = Math.min(left, row + 2)
    for (let i = 0; i < rowCount; i += 1) {
      const u = rowCount === 1 ? 0 : (i / (rowCount - 1)) * 2 - 1
      slots.push({
        lane: u * half * (0.62 + row * 0.2),
        dist: -18 - row * 22,
      })
    }
    left -= rowCount
    row += 1
  }
  return slots
}
