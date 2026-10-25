import { AU_KM, BODY_BY_ID, DAY_MS, J2000_MS } from '../data/bodies'
import { NODE_BY_ID } from '../data/nodes'
import type { BodyId, Vec2 } from '../types'

const DEG = Math.PI / 180

/** Heliocentric longitude (radians) of a body under the circular-orbit approximation. */
export function bodyLongitude(id: BodyId, t: number): number {
  const b = BODY_BY_ID[id]
  const days = (t - J2000_MS) / DAY_MS
  return (b.l0 + (360 * days) / b.periodDays) * DEG
}

export function bodyPosition(id: BodyId, t: number): Vec2 {
  const b = BODY_BY_ID[id]
  if (b.a === 0) return { x: 0, y: 0 }
  const l = bodyLongitude(id, t)
  return { x: b.a * Math.cos(l), y: b.a * Math.sin(l) }
}

export function nodePosition(nodeId: string, t: number): Vec2 {
  const n = NODE_BY_ID[nodeId]
  if (!n) return { x: 0, y: 0 }
  const b = BODY_BY_ID[n.body]
  const l = bodyLongitude(n.body, t) + n.offsetDeg * DEG
  return { x: b.a * Math.cos(l), y: b.a * Math.sin(l) }
}

export const auToKm = (au: number) => au * AU_KM
export const kmToAu = (km: number) => km / AU_KM
