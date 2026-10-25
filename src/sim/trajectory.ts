import { AU_KM } from '../data/bodies'
import { NODE_BY_ID } from '../data/nodes'
import type { Leg, MissionStatus, Ship, Vec2 } from '../types'
import { nodePosition } from './orbits'
import { add, dist, len, lerp, norm, perp, scale, sub } from './vec'

/**
 * Illustrative transfer geometry. Each leg is a quadratic Bézier between fixed heliocentric
 * points, traversed linearly in time. It is a readable stand-in for a real trajectory
 * (no Lambert solution, no gravity) and is labelled as such everywhere in the UI.
 */

export function bezier(leg: Leg, s: number): Vec2 {
  const u = 1 - s
  return {
    x: u * u * leg.p0.x + 2 * u * s * leg.c.x + s * s * leg.p1.x,
    y: u * u * leg.p0.y + 2 * u * s * leg.c.y + s * s * leg.p1.y,
  }
}

/** dB/ds. */
function bezierDeriv(leg: Leg, s: number): Vec2 {
  return add(scale(sub(leg.c, leg.p0), 2 * (1 - s)), scale(sub(leg.p1, leg.c), 2 * s))
}

/** Builds one leg, bowing outward (away from the Sun) so arcs never cut through it. */
export function makeLeg(p0: Vec2, p1: Vec2, t0: number, t1: number, viaNodeId?: string, curvature = 0.12, startDir?: Vec2): Leg {
  const chord = sub(p1, p0)
  // Re-planned legs continue the current heading so the maneuver is a speed change, not a kink.
  if (startDir && len(startDir) > 0) return { p0, c: add(p0, scale(norm(startDir), len(chord) * 0.45)), p1, t0, t1, viaNodeId }
  const mid = lerp(p0, p1, 0.5)
  let n = norm(perp(chord))
  if (n.x * mid.x + n.y * mid.y < 0) n = scale(n, -1)
  let k = curvature * len(chord)
  // Keep the arc's midpoint clear of the Sun.
  const arcMid = (offset: number) => add(mid, scale(n, offset / 2))
  while (len(arcMid(k)) < 0.3 && k < 3) k += 0.1
  return { p0, c: add(mid, scale(n, k)), p1, t0, t1, viaNodeId }
}

/** Splits a leg at time t and returns the part already flown (exact, via de Casteljau). */
export function truncateLeg(leg: Leg, t: number): Leg {
  const s = (t - leg.t0) / (leg.t1 - leg.t0)
  return { p0: leg.p0, c: lerp(leg.p0, leg.c, s), p1: bezier(leg, s), t0: leg.t0, t1: t, viaNodeId: undefined }
}

export type Waypoint = { nodeId: string } | { point: Vec2 }

/**
 * Plans legs from `from` (at t0) through waypoints to the destination port, arriving at t1.
 * Moving node positions are predicted at the time the ship reaches them (two refinement passes).
 */
export function planRoute(from: Vec2, destId: string, t0: number, t1: number, waypoints: Waypoint[] = [], startDir?: Vec2): Leg[] {
  const stops = [...waypoints, { nodeId: destId }]
  const at = (w: Waypoint, t: number) => ('point' in w ? w.point : nodePosition(w.nodeId, t))
  let times = stops.map((_, i) => t0 + ((t1 - t0) * (i + 1)) / stops.length)
  for (let pass = 0; pass < 2; pass++) {
    const pts = [from, ...stops.map((w, i) => at(w, times[i]))]
    const lengths = pts.slice(1).map((p, i) => dist(pts[i], p))
    const total = lengths.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    times = lengths.map((l) => {
      acc += l
      return t0 + ((t1 - t0) * acc) / total
    })
    times[times.length - 1] = t1
  }
  const legs: Leg[] = []
  let p = from
  let t = t0
  stops.forEach((w, i) => {
    const q = at(w, times[i])
    legs.push(makeLeg(p, q, t, times[i], 'nodeId' in w ? w.nodeId : undefined, 0.12, i === 0 ? startDir : undefined))
    p = q
    t = times[i]
  })
  return legs
}

export const departureTime = (ship: Ship) => ship.legs[0]?.t0 ?? 0
export const arrivalTime = (ship: Ship) => ship.legs[ship.legs.length - 1]?.t1 ?? 0

export function missionStatus(ship: Ship, t: number): MissionStatus {
  if (!ship.legs.length || t >= arrivalTime(ship)) return 'docked'
  if (t < departureTime(ship)) return 'scheduled'
  return 'in_transit'
}

function legAt(ship: Ship, t: number): Leg | undefined {
  return ship.legs.find((l) => t >= l.t0 && t < l.t1)
}

export function shipPosition(ship: Ship, t: number): Vec2 {
  if (!ship.legs.length) return nodePosition(ship.destinationId, t)
  if (t < departureTime(ship)) return nodePosition(ship.originId, t)
  const leg = legAt(ship, t)
  if (!leg) return nodePosition(ship.destinationId, t)
  return bezier(leg, (t - leg.t0) / (leg.t1 - leg.t0))
}

/** Velocity in km/s (heliocentric frame). Zero while docked (port co-motion is ignored). */
export function shipVelocity(ship: Ship, t: number): Vec2 {
  const leg = legAt(ship, t)
  if (!leg) return { x: 0, y: 0 }
  const d = bezierDeriv(leg, (t - leg.t0) / (leg.t1 - leg.t0))
  const k = AU_KM / ((leg.t1 - leg.t0) / 1000)
  return { x: d.x * k, y: d.y * k }
}

export const shipSpeed = (ship: Ship, t: number) => len(shipVelocity(ship, t))

/** Heading in degrees, 0° = +x (vernal equinox direction), counter-clockwise. */
export function shipHeading(ship: Ship, t: number): number {
  const vel = shipVelocity(ship, t)
  return ((Math.atan2(vel.y, vel.x) * 180) / Math.PI + 360) % 360
}

/** Points along the planned path between two times, for drawing. */
export function sampleTrack(ship: Ship, from: number, to: number, n = 64): Vec2[] {
  if (to <= from) return []
  return Array.from({ length: n + 1 }, (_, i) => shipPosition(ship, from + ((to - from) * i) / n))
}

/** Total path length remaining, AU (sampled). */
export function remainingDistanceAu(ship: Ship, t: number): number {
  const pts = sampleTrack(ship, Math.max(t, departureTime(ship)), arrivalTime(ship), 48)
  let d = 0
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i])
  return d
}

/** Replaces the remaining route from time `now`, keeping the flown part for history. */
export function replaceRemainingRoute(ship: Ship, now: number, legs: Leg[]): Leg[] {
  const flown = ship.legs
    .filter((l) => l.t0 < now)
    .map((l) => (l.t1 > now ? truncateLeg(l, now) : l))
  return [...flown, ...legs]
}

export const nodeName = (id: string) => NODE_BY_ID[id]?.name ?? id
