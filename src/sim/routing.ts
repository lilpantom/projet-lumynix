import { AU_KM, DAY_MS, HOUR_MS } from '../data/bodies'
import { NODE_BY_ID, NODES } from '../data/nodes'
import type { Priority, Ship, SimState } from '../types'
import { isCovered } from './comms'
import { worstApproach } from './conflicts'
import { nodePosition } from './orbits'
import { arrivalTime, departureTime, missionStatus, planRoute, replaceRemainingRoute, sampleTrack, shipPosition, shipVelocity, type Waypoint } from './trajectory'
import { add, dist, len, norm, perp, scale, sub } from './vec'

/**
 * Explainable route planning. Candidates are generated (direct, via each relay/port waypoint, the
 * Dijkstra-cheapest multi-hop path over the waypoint graph, and timing variants), then each is scored
 * with a weighted sum of normalised factors. Weights are user-configurable and every factor is shown.
 */

export interface RouteWeights {
  time: number
  fuel: number
  risk: number
  relay: number
  docking: number
}

export const DEFAULT_WEIGHTS: RouteWeights = { time: 1, fuel: 1, risk: 2, relay: 0.5, docking: 0.5 }

/** Percent of fuel per (km/s) of Δv change, and per AU of extra path. Illustrative constants. */
const FUEL_PER_DV = 0.08
const FUEL_PER_AU = 4

export type CandidateKind = 'current' | 'direct' | 'via' | 'dijkstra' | 'delay' | 'expedite' | 'offset'

export interface RouteCandidate {
  id: string
  kind: CandidateKind
  viaNodeIds: string[]
  /** Hours relative to the current plan (+ = later). */
  delayH: number
  ship: Ship
  arrival: number
  fuelCost: number
  fuelAfter: number
  minSepKm: number | null
  conflictWith: string | null
  relayCoverage: number
  dockingLoad: number
  pathAu: number
  score: number
  feasible: boolean
  factors: { time: number; fuel: number; risk: number; relay: number; docking: number }
}

const PRIORITY_TIME_FACTOR: Record<Priority, number> = { low: 0.6, normal: 1, high: 1.5, critical: 2.5 }

function pathLength(ship: Ship, from: number) {
  const pts = sampleTrack(ship, from, arrivalTime(ship), 64)
  let d = 0
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i])
  return d
}

/** Occupied berths at a port at time t (ships docked there, including those arriving earlier). */
export function dockingOccupancy(ships: Ship[], portId: string, t: number, excludeId?: string) {
  return ships.filter((s) => s.id !== excludeId && s.destinationId === portId && missionStatus(s, t) === 'docked').length
}

/** Start point and time for a re-plan: now if in flight, else the scheduled departure. */
function replanStart(ship: Ship, now: number) {
  const t0 = Math.max(now, departureTime(ship))
  return { t0, from: shipPosition(ship, t0) }
}

export function withRoute(ship: Ship, now: number, arrival: number, waypoints: Waypoint[]): Ship {
  const { t0, from } = replanStart(ship, now)
  const heading = missionStatus(ship, t0) === 'in_transit' ? shipVelocity(ship, t0) : undefined
  const legs = planRoute(from, ship.destinationId, t0, Math.max(arrival, t0 + 2 * HOUR_MS), waypoints, heading)
  return { ...ship, legs: replaceRemainingRoute(ship, t0, legs) }
}

/** Fuel cost of switching to `next`: Δv at the switch point plus any extra path length. */
export function maneuverFuelCost(current: Ship, next: Ship, now: number) {
  const t0 = Math.max(now, departureTime(current))
  const dv = len(sub(shipVelocity(next, t0 + 1), shipVelocity(current, t0 - 1)))
  const inFlight = missionStatus(current, now) === 'in_transit'
  const extraAu = Math.max(0, pathLength(next, t0) - pathLength(current, t0))
  return (inFlight ? dv * FUEL_PER_DV : 0) + extraAu * FUEL_PER_AU
}

/** Dijkstra over ports/relays (edge cost = AU, with a hop penalty) from the ship to its destination. */
export function dijkstraWaypoints(ship: Ship, now: number): string[] {
  const { from, t0 } = replanStart(ship, now)
  const ids = NODES.map((n) => n.id).filter((id) => id !== ship.originId)
  const pos = (id: string) => (id === '__start' ? from : nodePosition(id, t0))
  const all = ['__start', ...ids]
  const costs = new Map(all.map((id) => [id, Infinity]))
  const prev = new Map<string, string>()
  costs.set('__start', 0)
  const open = new Set(all)
  const HOP_PENALTY = 0.25
  const MAX_EDGE = 3
  while (open.size) {
    let u = ''
    let best = Infinity
    for (const id of open) if (costs.get(id)! < best) (best = costs.get(id)!), (u = id)
    if (!u || u === ship.destinationId) break
    open.delete(u)
    for (const w of open) {
      const d = dist(pos(u), pos(w))
      if (d > MAX_EDGE && w !== ship.destinationId) continue
      const c = best + d + (w === ship.destinationId ? 0 : HOP_PENALTY)
      if (c < costs.get(w)!) {
        costs.set(w, c)
        prev.set(w, u)
      }
    }
  }
  const path: string[] = []
  for (let at = prev.get(ship.destinationId); at && at !== '__start'; at = prev.get(at)) path.unshift(at)
  return path
}

function evaluate(
  state: SimState,
  current: Ship,
  candidate: Ship,
  meta: Pick<RouteCandidate, 'id' | 'kind' | 'viaNodeIds'>,
  extraFuel = 0,
): Omit<RouteCandidate, 'score' | 'factors'> {
  const now = state.time
  const others = state.ships.filter((s) => s.id !== current.id)
  const worst = worstApproach(candidate, others, now, state.settings)
  const arrival = arrivalTime(candidate)
  const fuelCost = meta.kind === 'current' ? 0 : maneuverFuelCost(current, candidate, now) + extraFuel
  const t0 = Math.max(now, departureTime(candidate))
  const pts = sampleTrack(candidate, t0, arrival, 24)
  const covered = pts.filter((p, i) => isCovered(state, p, t0 + ((arrival - t0) * i) / 24)).length
  const node = NODE_BY_ID[candidate.destinationId]
  const occ = dockingOccupancy(state.ships, candidate.destinationId, arrival, candidate.id)
  return {
    ...meta,
    delayH: (arrival - arrivalTime(current)) / HOUR_MS,
    ship: candidate,
    arrival,
    fuelCost,
    fuelAfter: current.fuel - fuelCost,
    minSepKm: worst?.minSepKm ?? null,
    conflictWith: worst && worst.minSepKm < state.settings.thresholdKm ? worst.otherId : null,
    relayCoverage: pts.length ? covered / pts.length : 1,
    dockingLoad: node?.berths ? (occ + 1) / node.berths : 0,
    pathAu: pathLength(candidate, t0),
    feasible: current.fuel - fuelCost > 5,
  }
}

function score(c: Omit<RouteCandidate, 'score' | 'factors'>, ship: Ship, threshold: number, w: RouteWeights): RouteCandidate {
  // Each factor is normalised to roughly 0 (good) … 1 (bad).
  const time = (Math.max(0, c.delayH) / 24) * PRIORITY_TIME_FACTOR[ship.priority]
  const fuel = c.fuelCost / 10
  const risk = c.minSepKm === null ? 0 : Math.max(0, 1 - c.minSepKm / (threshold * 1.5)) * 2
  const relay = 1 - c.relayCoverage
  const docking = Math.max(0, c.dockingLoad - 0.75) * 2
  const factors = { time, fuel, risk, relay, docking }
  const total = time * w.time + fuel * w.fuel + risk * w.risk + relay * w.relay + docking * w.docking + (c.feasible ? 0 : 100)
  return { ...c, factors, score: total }
}

/** Generates and scores alternatives for a ship. The first element is always the current plan. */
export function routeCandidates(state: SimState, shipId: string, weights: RouteWeights = DEFAULT_WEIGHTS): RouteCandidate[] {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship || missionStatus(ship, state.time) === 'docked') return []
  const now = state.time
  const arr = arrivalTime(ship)
  const t0 = Math.max(now, departureTime(ship))
  const remaining = arr - t0
  const raw: Omit<RouteCandidate, 'score' | 'factors'>[] = []
  raw.push(evaluate(state, ship, ship, { id: 'current', kind: 'current', viaNodeIds: [] }))

  const viaIds = ship.legs.filter((l) => l.t1 > now && l.viaNodeId && l.viaNodeId !== ship.destinationId).map((l) => l.viaNodeId!)
  if (viaIds.length) raw.push(evaluate(state, ship, withRoute(ship, now, arr, []), { id: 'direct', kind: 'direct', viaNodeIds: [] }))

  // Single-waypoint detours that don't add more than 60% path length.
  const directLen = dist(shipPosition(ship, t0), nodePosition(ship.destinationId, arr))
  for (const n of NODES) {
    if (n.id === ship.destinationId || n.id === ship.originId) continue
    const p = nodePosition(n.id, t0 + remaining / 2)
    const detour = dist(shipPosition(ship, t0), p) + dist(p, nodePosition(ship.destinationId, arr))
    if (detour > directLen * 1.6 + 0.05) continue
    const extraH = Math.round(((detour - directLen) / Math.max(directLen, 0.01)) * (remaining / HOUR_MS) * 0.5)
    const cand = withRoute(ship, now, arr + extraH * HOUR_MS, [{ nodeId: n.id }])
    raw.push(evaluate(state, ship, cand, { id: `via-${n.id}`, kind: 'via', viaNodeIds: [n.id] }))
  }

  const dj = dijkstraWaypoints(ship, now)
  if (dj.length > 1) {
    const cand = withRoute(ship, now, arr + 6 * HOUR_MS, dj.map((nodeId) => ({ nodeId })))
    raw.push(evaluate(state, ship, cand, { id: 'dijkstra', kind: 'dijkstra', viaNodeIds: dj }))
  }

  for (const h of [3, 8]) {
    raw.push(evaluate(state, ship, withRoute(ship, now, arr + h * HOUR_MS, viaWaypoints(ship, now)), { id: `delay-${h}`, kind: 'delay', viaNodeIds: viaIds }))
  }
  if (remaining > 12 * HOUR_MS) {
    // Expediting needs extra energy proportional to the speed-up.
    const cand = withRoute(ship, now, arr - 4 * HOUR_MS, viaWaypoints(ship, now))
    raw.push(evaluate(state, ship, cand, { id: 'expedite-4', kind: 'expedite', viaNodeIds: viaIds }, (4 * HOUR_MS * 6) / Math.max(remaining, DAY_MS)))
  }
  const off = offsetCandidate(state, ship)
  if (off) raw.push(evaluate(state, ship, off, { id: 'offset', kind: 'offset', viaNodeIds: [] }))

  const scored = raw.map((c) => score(c, ship, state.settings.thresholdKm, weights))
  const [current, ...rest] = scored
  return [current, ...rest.sort((a, b) => a.score - b.score)]
}

function viaWaypoints(ship: Ship, now: number): Waypoint[] {
  return ship.legs.filter((l) => l.t1 > now && l.viaNodeId && l.viaNodeId !== ship.destinationId).map((l) => ({ nodeId: l.viaNodeId! }))
}

/** Lateral offset maneuver: a waypoint displaced sideways from the predicted closest-approach point. */
function offsetCandidate(state: SimState, ship: Ship): Ship | null {
  const conflict = state.conflicts.find((c) => c.a === ship.id || c.b === ship.id)
  if (!conflict || conflict.tca <= state.time) return null
  const p = shipPosition(ship, conflict.tca)
  const other = state.ships.find((s) => s.id === (conflict.a === ship.id ? conflict.b : conflict.a))
  if (!other) return null
  const away = norm(sub(p, shipPosition(other, conflict.tca)))
  const dir = len(away) > 0 ? away : norm(perp(shipVelocity(ship, conflict.tca)))
  const offsetAu = (state.settings.thresholdKm * 2.5) / AU_KM
  return withRoute(ship, state.time, arrivalTime(ship) + HOUR_MS, [{ point: add(p, scale(dir, offsetAu)) }])
}
