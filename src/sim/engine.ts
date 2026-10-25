import { DAY_MS, HOUR_MS } from '../data/bodies'
import { NODE_BY_ID } from '../data/nodes'
import type { AuditEntry, CommStatus, Conflict, EventSeverity, RiskLevel, Ship, SimEvent, SimSettings, SimState } from '../types'
import { commDelayMin, commStatus } from './comms'
import { detectConflicts, pairId } from './conflicts'
import { addNote, ageComponents, completeService, componentLevel, scheduleInspection } from './maintenance'
import { nodePosition } from './orbits'
import { step } from './random'
import type { RouteCandidate } from './routing'
import { routeThroughEncounter } from './scenario'
import { arrivalTime, missionStatus, planRoute, shipPosition, shipSpeed } from './trajectory'

/**
 * Pure simulation engine. Every function takes a state and returns a new one; React never mutates
 * state directly. Integration runs in ≤30-minute sub-steps so departures, arrivals and threshold
 * crossings are detected in order even at high simulation speeds.
 */

const SUBSTEP_MS = 30 * 60_000
const MAX_EVENTS = 300
const MAX_SAMPLES = 96
export const FUEL_WARN = 15
export const FUEL_CRIT = 8

function clone(state: SimState): SimState {
  return structuredClone(state)
}

function pushEvent(state: SimState, severity: EventSeverity, key: string, params: SimEvent['params'], shipId?: string) {
  state.eventSeq += 1
  state.events.unshift({ id: `E${state.eventSeq}`, at: state.time, severity, key, params, shipId, read: severity === 'info' })
  if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS
}

function pushAudit(state: SimState, entry: Omit<AuditEntry, 'id' | 'at'>) {
  state.audit.unshift({ id: `A${state.audit.length + 1}-${state.eventSeq}`, at: state.time, ...entry })
  if (state.audit.length > 200) state.audit.length = 200
}

function rand(state: SimState) {
  const [value, next] = step(state.rng)
  state.rng = next
  return value
}

function fireScript(state: SimState) {
  const due = state.pendingScript.filter((e) => e.at <= state.time)
  if (!due.length) return
  state.pendingScript = state.pendingScript.filter((e) => e.at > state.time)
  for (const e of due) {
    if (e.type === 'comm_fault') {
      state.ships = state.ships.map((s) => (s.id === e.shipId ? { ...s, commFaultUntil: e.at + e.hours * HOUR_MS } : s))
    } else if (e.type === 'relay_outage') {
      state.relayOutages[e.nodeId] = e.at + e.hours * HOUR_MS
      pushEvent(state, 'warn', 'ev.relayOutage', { node: NODE_BY_ID[e.nodeId]?.name ?? e.nodeId, hours: e.hours })
    } else if (e.type === 'wear_spike') {
      state.components = state.components.map((c) => (c.id === e.componentId ? { ...c, wear: Math.min(100, c.wear + e.amount) } : c))
    }
  }
}

function substep(state: SimState, dt: number) {
  const prevT = state.time
  const prevComm = new Map<string, CommStatus>(state.ships.map((s) => [s.id, commStatus(state, s, prevT)]))
  const prevLevels = new Map(state.components.map((c) => [c.id, componentLevel(c, prevT)]))
  const prevOutages = { ...state.relayOutages }
  state.time = prevT + dt
  const t = state.time
  fireScript(state)

  state.ships = state.ships.map((s) => {
    const before = missionStatus(s, prevT)
    const after = missionStatus(s, t)
    if (before !== 'in_transit' && after === 'in_transit')
      pushEvent(state, 'info', 'ev.departed', { ship: s.id, node: NODE_BY_ID[s.originId]?.name ?? s.originId }, s.id)
    if (before === 'in_transit' && after === 'docked')
      pushEvent(state, 'info', 'ev.arrived', { ship: s.id, node: NODE_BY_ID[s.destinationId]?.name ?? s.destinationId }, s.id)
    if (after !== 'in_transit' && before !== 'in_transit') return s
    const flying = Math.min(t, arrivalTime(s)) - Math.max(prevT, s.legs[0]?.t0 ?? prevT)
    const fuel = Math.max(0, s.fuel - (s.burnPerDay * Math.max(0, flying)) / DAY_MS)
    if (s.fuel >= FUEL_CRIT && fuel < FUEL_CRIT) pushEvent(state, 'crit', 'ev.fuelCritical', { ship: s.id, fuel: Math.round(fuel) }, s.id)
    else if (s.fuel >= FUEL_WARN && fuel < FUEL_WARN) pushEvent(state, 'warn', 'ev.fuelLow', { ship: s.id, fuel: Math.round(fuel) }, s.id)
    return { ...s, fuel }
  })

  for (const s of state.ships) {
    const before = prevComm.get(s.id)
    const after = commStatus(state, s, t)
    if (before === after || before === undefined) continue
    if (after === 'lost') pushEvent(state, 'crit', 'ev.commLost', { ship: s.id }, s.id)
    else if (after === 'degraded') pushEvent(state, 'warn', 'ev.commDegraded', { ship: s.id }, s.id)
    else pushEvent(state, 'info', 'ev.commRestored', { ship: s.id }, s.id)
  }
  for (const [id, until] of Object.entries(prevOutages)) {
    if (until > prevT && until <= t) pushEvent(state, 'info', 'ev.relayRestored', { node: NODE_BY_ID[id]?.name ?? id })
  }

  ageComponents(state, dt)
  for (const c of state.components) {
    const before = prevLevels.get(c.id)
    const after = componentLevel(c, t)
    if (before === after) continue
    if (after === 'crit') pushEvent(state, 'crit', 'ev.maintCrit', { asset: c.assetId, component: c.kind }, c.assetKind === 'ship' ? c.assetId : undefined)
    else if (after === 'warn' && before === 'ok') pushEvent(state, 'warn', 'ev.maintWarn', { asset: c.assetId, component: c.kind }, c.assetKind === 'ship' ? c.assetId : undefined)
  }

  if (t >= state.nextSampleAt) {
    for (const s of state.ships) {
      const arr = state.telemetry[s.id] ?? (state.telemetry[s.id] = [])
      arr.push({ t, speedKms: missionStatus(s, t) === 'in_transit' ? shipSpeed(s, t) : 0, fuel: s.fuel, commDelayMin: commDelayMin(shipPosition(s, t), t) })
      if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES)
    }
    state.nextSampleAt = t + HOUR_MS
  }
}

/** Recomputes conflicts and logs new, escalated and cleared ones. */
export function refreshConflicts(state: SimState) {
  const prev = new Map(state.conflicts.map((c) => [c.id, c]))
  const next = detectConflicts(state.ships, state.time, state.settings)
  for (const c of next) {
    const old = prev.get(c.id)
    if (!old) pushEvent(state, c.severity, 'ev.conflictNew', { a: c.a, b: c.b, sepKm: Math.round(c.minSepKm), at: c.tca }, c.a)
    else if (old.severity === 'warn' && c.severity === 'crit') pushEvent(state, 'crit', 'ev.conflictEscalated', { a: c.a, b: c.b, sepKm: Math.round(c.minSepKm) }, c.a)
  }
  const nextIds = new Set(next.map((c) => c.id))
  for (const c of prev.values()) {
    if (!nextIds.has(c.id)) {
      // A pair that passed its closest approach simply leaves the horizon; otherwise it was resolved.
      pushEvent(state, 'info', c.tca <= state.time ? 'ev.conflictPassed' : 'ev.conflictCleared', { a: c.a, b: c.b }, c.a)
    }
  }
  state.conflicts = next
}

export function advance(input: SimState, dtMs: number): SimState {
  if (dtMs <= 0) return input
  const state = clone(input)
  let remaining = dtMs
  while (remaining > 0) {
    const dt = Math.min(SUBSTEP_MS, remaining)
    substep(state, dt)
    remaining -= dt
  }
  refreshConflicts(state)
  return state
}

/* ---- Derived risk ------------------------------------------------------------------------- */

export type RiskReason = 'conflict_crit' | 'conflict_warn' | 'fuel_crit' | 'fuel_warn' | 'comm_lost' | 'comm_degraded' | 'maint_crit' | 'maint_warn'

export function shipRisk(state: SimState, ship: Ship): { level: RiskLevel; reasons: RiskReason[] } {
  const t = state.time
  const reasons: RiskReason[] = []
  const conflicts = state.conflicts.filter((c) => c.a === ship.id || c.b === ship.id)
  if (conflicts.some((c) => c.severity === 'crit')) reasons.push('conflict_crit')
  else if (conflicts.length) reasons.push('conflict_warn')
  const transit = missionStatus(ship, t) === 'in_transit'
  if (transit && ship.fuel < FUEL_CRIT) reasons.push('fuel_crit')
  else if (transit && ship.fuel < FUEL_WARN) reasons.push('fuel_warn')
  const comm = commStatus(state, ship, t)
  if (comm === 'lost') reasons.push('comm_lost')
  else if (comm === 'degraded') reasons.push('comm_degraded')
  const levels = state.components.filter((c) => c.assetId === ship.id).map((c) => componentLevel(c, t))
  if (levels.includes('crit')) reasons.push('maint_crit')
  else if (levels.includes('warn')) reasons.push('maint_warn')

  const crit = reasons.some((r) => r === 'conflict_crit' || r === 'fuel_crit' || r === 'maint_crit')
  const warn = reasons.some((r) => r === 'conflict_warn' || r === 'fuel_warn' || r === 'maint_warn' || r === 'comm_degraded')
  // Lost telemetry means we can't verify the ship's state: grey unless something is known to be wrong.
  const level: RiskLevel = crit ? 'crit' : warn ? 'warn' : comm === 'lost' ? 'unknown' : 'ok'
  return { level, reasons }
}

export const RISK_ORDER: Record<RiskLevel, number> = { crit: 3, warn: 2, unknown: 1, ok: 0 }

/* ---- Actions ------------------------------------------------------------------------------ */

export function applyRouteCandidate(input: SimState, shipId: string, cand: RouteCandidate, conflictId?: string): SimState {
  const state = clone(input)
  const before = state.conflicts.find((c) => c.id === conflictId)
  state.ships = state.ships.map((s) => (s.id === shipId ? { ...cand.ship, fuel: Math.max(0, s.fuel - cand.fuelCost) } : s))
  refreshConflicts(state)
  const after = conflictId ? state.conflicts.find((c) => c.id === conflictId) : undefined
  const outcome: AuditEntry['outcome'] = !conflictId ? 'applied' : !after ? 'resolved' : before && after.minSepKm > before.minSepKm ? 'reduced' : 'unresolved'
  const actionParams = { h: Math.abs(Math.round(cand.delayH)), node: cand.viaNodeIds[0] ?? '' }
  pushEvent(state, 'info', 'ev.maneuver', { ship: shipId, action: `route.kind.${cand.kind}`, ...actionParams }, shipId)
  pushAudit(state, {
    shipId,
    conflictId,
    action: `route.kind.${cand.kind}`,
    actionParams,
    detail: `${cand.viaNodeIds.join(' → ') || '—'} | Δt ${cand.delayH.toFixed(1)} h | fuel −${cand.fuelCost.toFixed(2)} %`,
    outcome,
  })
  return state
}

export function acknowledgeConflict(input: SimState, conflict: Conflict): SimState {
  const state = clone(input)
  pushAudit(state, { shipId: conflict.a, conflictId: conflict.id, action: 'audit.acknowledged', detail: `${conflict.a} / ${conflict.b}`, outcome: 'applied' })
  return state
}

export interface NewShipInput {
  id: string
  name: string
  missionType: Ship['missionType']
  cargo: Ship['cargo']
  priority: Ship['priority']
  originId: string
  destinationId: string
  departInH: number
  transitDays: number
  crewCount: number
}

export function addShip(input: SimState, data: NewShipInput): SimState {
  const state = clone(input)
  const t0 = state.time + data.departInH * HOUR_MS
  const t1 = t0 + data.transitDays * DAY_MS
  const ship: Ship = {
    id: data.id,
    name: data.name,
    missionType: data.missionType,
    cargo: data.cargo,
    priority: data.priority,
    originId: data.originId,
    destinationId: data.destinationId,
    legs: planRoute(nodePosition(data.originId, t0), data.destinationId, t0, t1),
    fuel: 100,
    burnPerDay: 0.5,
    crewCount: data.crewCount,
  }
  state.ships.push(ship)
  state.telemetry[ship.id] = []
  pushEvent(state, 'info', 'ev.shipAdded', { ship: ship.id }, ship.id)
  refreshConflicts(state)
  return state
}

export function updateShip(input: SimState, oldId: string, patch: Pick<Ship, 'id' | 'name' | 'cargo' | 'priority' | 'missionType'>): SimState {
  const state = clone(input)
  const rename = (id: string) => (id === oldId ? patch.id : id)
  state.ships = state.ships.map((s) => (s.id === oldId ? { ...s, ...patch } : s))
  state.components = state.components.map((c) => (c.assetId === oldId ? { ...c, assetId: patch.id, id: c.id.replace(`${oldId}:`, `${patch.id}:`) } : c))
  if (oldId !== patch.id) {
    state.telemetry[patch.id] = state.telemetry[oldId] ?? []
    delete state.telemetry[oldId]
    state.events = state.events.map((e) => (e.shipId === oldId ? { ...e, shipId: patch.id } : e))
    state.audit = state.audit.map((a) => ({ ...a, shipId: rename(a.shipId) }))
    state.pendingScript = state.pendingScript.map((e) => (e.type === 'comm_fault' ? { ...e, shipId: rename(e.shipId) } : e))
  }
  pushEvent(state, 'info', 'ev.shipUpdated', { ship: patch.id }, patch.id)
  refreshConflicts(state)
  return state
}

/**
 * Drill: spawns a fictional ship routed to pass close to `targetId` within the horizon, so the full
 * detect → inspect → resolve workflow can be exercised on demand.
 */
export function triggerConflictDrill(input: SimState, targetId: string, existingIds: string[]): { state: SimState; shipId: string } | null {
  const target = input.ships.find((s) => s.id === targetId)
  if (!target || missionStatus(target, input.time) !== 'in_transit') return null
  const tc = Math.min(input.time + (input.settings.horizonH / 3) * HOUR_MS, arrivalTime(target) - 2 * HOUR_MS)
  if (tc <= input.time + HOUR_MS) return null
  const state = clone(input)
  let n = 1
  while (existingIds.includes(`DRILL-${String(n).padStart(2, '0')}`)) n++
  const id = `DRILL-${String(n).padStart(2, '0')}`
  const ports = ['CRT', 'ARS', 'CER', 'HNB', 'VST'].filter((p) => p !== target.destinationId && p !== target.originId)
  const origin = ports[Math.floor(rand(state) * ports.length)]
  const dest = ports.filter((p) => p !== origin)[Math.floor(rand(state) * (ports.length - 1))]
  const base: Ship = {
    id,
    name: 'Drill Vessel',
    missionType: 'cargo',
    cargo: 'supplies',
    priority: 'normal',
    originId: origin,
    destinationId: dest,
    legs: [],
    fuel: 80,
    burnPerDay: 0.4,
    crewCount: 2,
  }
  const offsetKm = state.settings.thresholdKm * (0.1 + rand(state) * 0.15)
  const ship = routeThroughEncounter(base, target, tc, offsetKm, 20 * DAY_MS)
  state.ships.push(ship)
  state.telemetry[id] = []
  pushEvent(state, 'warn', 'ev.drill', { ship: id, other: targetId }, id)
  refreshConflicts(state)
  return { state, shipId: id }
}

export function updateSettings(input: SimState, settings: SimSettings): SimState {
  const state = clone(input)
  state.settings = settings
  refreshConflicts(state)
  return state
}

export function serviceComponent(input: SimState, componentId: string): SimState {
  const state = clone(input)
  const c = state.components.find((x) => x.id === componentId)
  if (!c) return input
  state.components = state.components.map((x) => (x.id === componentId ? completeService(x, state.time) : x))
  pushEvent(state, 'info', 'ev.maintDone', { asset: c.assetId, component: c.kind }, c.assetKind === 'ship' ? c.assetId : undefined)
  return state
}

export function scheduleComponentInspection(input: SimState, componentId: string, inHours: number): SimState {
  const state = clone(input)
  state.components = state.components.map((x) => (x.id === componentId ? scheduleInspection(x, state.time + inHours * HOUR_MS, state.time) : x))
  return state
}

export function noteComponent(input: SimState, componentId: string, text: string): SimState {
  const state = clone(input)
  state.components = state.components.map((x) => (x.id === componentId ? addNote(x, text, state.time) : x))
  return state
}

export function markEventsRead(input: SimState, ids?: string[]): SimState {
  const state = clone(input)
  state.events = state.events.map((e) => (!ids || ids.includes(e.id) ? { ...e, read: true } : e))
  return state
}

export { pairId }
