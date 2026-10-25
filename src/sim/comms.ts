import { AU_KM, LIGHT_KMS } from '../data/bodies'
import { RELAYS } from '../data/nodes'
import type { CommStatus, Ship, SimState, Vec2 } from '../types'
import { bodyPosition, nodePosition } from './orbits'
import { missionStatus, shipPosition } from './trajectory'
import { dist, len, sub } from './vec'

/** Simplified coverage model: Earth stations reach 2 AU; each operating relay reaches 1.5 AU. */
export const EARTH_RANGE_AU = 2
export const RELAY_RANGE_AU = 1.5
/** Sun–Earth–ship angle below which the solar corona blocks the link (real effect, simplified). */
export const CONJUNCTION_DEG = 2

export function relayOperational(state: Pick<SimState, 'relayOutages'>, relayId: string, t: number) {
  return (state.relayOutages[relayId] ?? 0) <= t
}

export function isCovered(state: Pick<SimState, 'relayOutages'>, p: Vec2, t: number): boolean {
  if (dist(p, bodyPosition('earth', t)) <= EARTH_RANGE_AU) return true
  return RELAYS.some((r) => relayOperational(state, r.id, t) && dist(p, nodePosition(r.id, t)) <= RELAY_RANGE_AU)
}

/** One-way light time ship → Earth, minutes. */
export function commDelayMin(p: Vec2, t: number): number {
  return (dist(p, bodyPosition('earth', t)) * AU_KM) / LIGHT_KMS / 60
}

export function solarConjunction(p: Vec2, t: number): boolean {
  const earth = bodyPosition('earth', t)
  const toSun = sub({ x: 0, y: 0 }, earth)
  const toShip = sub(p, earth)
  if (len(toShip) < 0.05) return false
  const cos = (toSun.x * toShip.x + toSun.y * toShip.y) / (len(toSun) * len(toShip))
  return Math.acos(Math.min(1, Math.max(-1, cos))) < (CONJUNCTION_DEG * Math.PI) / 180 && len(toShip) > len(toSun)
}

export function commStatus(state: Pick<SimState, 'relayOutages'>, ship: Ship, t: number): CommStatus {
  if ((ship.commFaultUntil ?? 0) > t) return 'lost'
  // Docked ships use the port's own link.
  if (missionStatus(ship, t) === 'docked') return 'nominal'
  const p = shipPosition(ship, t)
  if (solarConjunction(p, t)) return 'lost'
  return isCovered(state, p, t) ? 'nominal' : 'degraded'
}
