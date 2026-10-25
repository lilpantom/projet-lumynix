import { AU_KM, DAY_MS, HOUR_MS } from '../data/bodies'
import { FLEET, PLANTED, SCENARIO_START, type FleetSeed } from '../data/fleet'
import { NODES } from '../data/nodes'
import type { Component, ComponentKind, Ship, SimState, Vec2 } from '../types'
import { commDelayMin } from './comms'
import { detectConflicts } from './conflicts'
import { COMPONENT_SPEC } from './maintenance'
import { nodePosition } from './orbits'
import { makeRng } from './random'
import { missionStatus, planRoute, shipPosition, shipSpeed, shipVelocity } from './trajectory'
import { add, dist, norm, perp, scale } from './vec'

export const STATE_VERSION = 1
export const DEFAULT_SEED = 2148
export const DEFAULT_SETTINGS = { thresholdKm: 500_000, horizonH: 72 }

const SHIP_KINDS: ComponentKind[] = ['reactor_pump', 'engine_gimbal', 'scrubber', 'antenna', 'power_bus', 'radiator', 'shielding', 'docking_adapter']

/** Transit time from straight-line distance at a seeded cruise rate (0.05–0.09 AU/day). */
function transitMs(origin: string, dest: string, t0: number, rate: number) {
  const d = dist(nodePosition(origin, t0), nodePosition(dest, t0 + 20 * DAY_MS))
  return Math.max(3 * DAY_MS, (d / rate) * DAY_MS)
}

function seedShip(seed: FleetSeed, rate: number, burn: number): Ship {
  const t0 = SCENARIO_START + seed.departH * HOUR_MS
  const duration = seed.durationH ? seed.durationH * HOUR_MS : transitMs(seed.origin, seed.dest, t0, rate)
  return {
    id: seed.id,
    name: seed.name,
    missionType: seed.missionType,
    cargo: seed.cargo,
    priority: seed.priority,
    originId: seed.origin,
    destinationId: seed.dest,
    legs: planRoute(nodePosition(seed.origin, t0), seed.dest, t0, t0 + duration),
    fuel: seed.fuel,
    burnPerDay: burn,
    crewCount: seed.crew,
  }
}

/** Re-times a ship so that it arrives at `arrival` (keeping its departure). */
function retimeArrival(ship: Ship, arrival: number): Ship {
  const t0 = ship.legs[0].t0
  return { ...ship, legs: planRoute(nodePosition(ship.originId, t0), ship.destinationId, t0, arrival) }
}

/**
 * Routes `ship` so that it passes `offsetKm` beside `base`'s position at time `tc`. Used for the planted
 * scenario encounter and for the "simulate conflict" drill. Departure is solved so the timing matches.
 */
export function routeThroughEncounter(ship: Ship, base: Ship, tc: number, offsetKm: number, durationMs: number): Ship {
  const p = shipPosition(base, tc)
  const side = norm(perp(shipVelocity(base, tc)))
  const point: Vec2 = add(p, scale(side, offsetKm / AU_KM))
  let t0 = tc - durationMs / 2
  for (let i = 0; i < 3; i++) {
    const l1 = dist(nodePosition(ship.originId, t0), point)
    const l2 = dist(point, nodePosition(ship.destinationId, t0 + durationMs))
    t0 = tc - (durationMs * l1) / (l1 + l2 || 1)
  }
  return { ...ship, legs: planRoute(nodePosition(ship.originId, t0), ship.destinationId, t0, t0 + durationMs, [{ point }]) }
}

function seedComponents(rng: ReturnType<typeof makeRng>, ships: Ship[], start: number): Component[] {
  const out: Component[] = []
  const make = (assetId: string, assetKind: 'ship' | 'node', kind: ComponentKind, wearLo: number, wearHi: number): Component => {
    const spec = COMPONENT_SPEC[kind]
    const ageDays = rng.range(2, spec.intervalDays * 0.92)
    return {
      id: `${assetId}:${kind}`,
      assetId,
      assetKind,
      kind,
      wear: Math.round(rng.range(wearLo, wearHi) * 10) / 10,
      wearPerDay: Math.round(rng.range(0.3, 2.2) * 100) / 100,
      lastService: start - ageDays * DAY_MS,
      nextInspection: start + (spec.intervalDays - ageDays) * DAY_MS,
      spares: rng.int(0, 3),
      durationH: spec.durationH,
      history: [{ at: start - ageDays * DAY_MS, kind: 'service' }],
    }
  }
  for (const s of ships) {
    const kinds = [...SHIP_KINDS]
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1))
      ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
    }
    kinds.length = 5
    for (const k of kinds) out.push(make(s.id, 'ship', k, 6, 66))
  }
  for (const n of NODES) {
    if (n.kind === 'relay') out.push(make(n.id, 'node', 'relay_transmitter', 5, 60))
    else if (n.berths >= 3) out.push(make(n.id, 'node', 'docking_arm', 10, 72))
  }
  return out
}

export function createScenario(seed = DEFAULT_SEED, settings = DEFAULT_SETTINGS): SimState {
  const rng = makeRng(seed)
  const start = SCENARIO_START
  let ships = FLEET.map((f) => seedShip(f, rng.range(0.05, 0.09), Math.round(rng.range(0.25, 0.7) * 100) / 100))
  const byId = (id: string) => ships.find((s) => s.id === id)!
  const replace = (s: Ship) => (ships = ships.map((x) => (x.id === s.id ? s : x)))

  const { lead, trail, leadArrivalH, gapFraction } = PLANTED.arrivalPair
  replace(retimeArrival(byId(lead), start + leadArrivalH * HOUR_MS))
  // Solve the trailing arrival so its distance out when the leader docks is ≈ gapFraction × threshold.
  let gapMs = HOUR_MS
  for (let i = 0; i < 4; i++) {
    const trailShip = retimeArrival(byId(trail), start + leadArrivalH * HOUR_MS + gapMs)
    gapMs = ((settings.thresholdKm * gapFraction) / Math.max(1, shipSpeed(trailShip, start + leadArrivalH * HOUR_MS))) * 1000
  }
  replace(retimeArrival(byId(trail), start + leadArrivalH * HOUR_MS + gapMs))
  const cr = PLANTED.crossing
  replace(routeThroughEncounter(byId(cr.ship), byId(cr.base), start + cr.crossH * HOUR_MS, cr.offsetKm, cr.durationH * HOUR_MS))

  const components = seedComponents(rng, ships, start)
  const reactor = components.find((c) => c.assetId === 'NOVA-42' && c.kind === 'reactor_pump')
  const novaFirst = components.find((c) => c.assetId === 'NOVA-42')!

  const state: SimState = {
    version: STATE_VERSION,
    seed,
    rng: rng.state,
    time: start,
    startTime: start,
    ships,
    components,
    events: [],
    conflicts: [],
    telemetry: {},
    audit: [],
    relayOutages: {},
    pendingScript: [
      { at: start + 5 * HOUR_MS, type: 'comm_fault', shipId: 'ORION-315', hours: 6 },
      { at: start + 8 * HOUR_MS, type: 'wear_spike', componentId: (reactor ?? novaFirst).id, amount: 22 },
      { at: start + 12 * HOUR_MS, type: 'relay_outage', nodeId: 'R-ML4', hours: 24 },
    ],
    nextSampleAt: start + HOUR_MS,
    eventSeq: 0,
    settings: { ...settings },
  }
  state.telemetry = backfillTelemetry(state)
  state.conflicts = detectConflicts(state.ships, start, state.settings)
  return state
}

/** Model-generated history for the past 24 h so charts aren't empty on first load. */
function backfillTelemetry(state: SimState): SimState['telemetry'] {
  const out: SimState['telemetry'] = {}
  for (const s of state.ships) {
    out[s.id] = Array.from({ length: 25 }, (_, i) => {
      const t = state.time - (24 - i) * HOUR_MS
      const inTransit = missionStatus(s, t) === 'in_transit'
      const elapsed = (state.time - t) / DAY_MS
      return {
        t,
        speedKms: inTransit ? shipSpeed(s, t) : 0,
        fuel: Math.min(100, s.fuel + (inTransit ? s.burnPerDay * elapsed : 0)),
        commDelayMin: commDelayMin(shipPosition(s, t), t),
      }
    })
  }
  return out
}
