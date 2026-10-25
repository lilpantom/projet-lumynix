import { DAY_MS, HOUR_MS } from '../data/bodies'
import type { Component, ComponentKind, RiskLevel, Ship, SimState } from '../types'
import { missionStatus } from './trajectory'

/**
 * Rule-based maintenance (illustrative, not a validated predictive model). Wear grows linearly at a
 * seeded per-component rate; warnings come from transparent thresholds listed in `reasons()`.
 */
export const WEAR_WARN = 70
export const WEAR_CRIT = 85

export const COMPONENT_SPEC: Record<ComponentKind, { intervalDays: number; durationH: number; flightCritical: boolean; steps: number }> = {
  reactor_pump: { intervalDays: 30, durationH: 6, flightCritical: true, steps: 4 },
  engine_gimbal: { intervalDays: 45, durationH: 8, flightCritical: true, steps: 4 },
  scrubber: { intervalDays: 20, durationH: 3, flightCritical: true, steps: 3 },
  antenna: { intervalDays: 60, durationH: 4, flightCritical: false, steps: 3 },
  shielding: { intervalDays: 90, durationH: 12, flightCritical: false, steps: 3 },
  docking_adapter: { intervalDays: 40, durationH: 3, flightCritical: false, steps: 3 },
  power_bus: { intervalDays: 50, durationH: 5, flightCritical: true, steps: 4 },
  radiator: { intervalDays: 35, durationH: 4, flightCritical: false, steps: 3 },
  docking_arm: { intervalDays: 25, durationH: 6, flightCritical: false, steps: 3 },
  relay_transmitter: { intervalDays: 60, durationH: 5, flightCritical: false, steps: 3 },
}

export type MaintenanceReason = 'wear_crit' | 'wear_warn' | 'overdue' | 'no_spares' | 'due_soon'

export function reasons(c: Component, t: number): MaintenanceReason[] {
  const r: MaintenanceReason[] = []
  if (c.wear >= WEAR_CRIT) r.push('wear_crit')
  else if (c.wear >= WEAR_WARN) r.push('wear_warn')
  if (c.nextInspection < t) r.push('overdue')
  else if (c.nextInspection - t < 2 * DAY_MS) r.push('due_soon')
  if (c.spares === 0 && c.wear >= 60) r.push('no_spares')
  return r
}

export function componentLevel(c: Component, t: number): RiskLevel {
  const r = reasons(c, t)
  if (r.includes('wear_crit')) return 'crit'
  if (r.some((x) => x === 'wear_warn' || x === 'overdue' || x === 'no_spares')) return 'warn'
  return 'ok'
}

/** Projected time at which wear reaches the warning threshold (null if already past or not wearing). */
export function projectedWarnTime(c: Component, t: number): number | null {
  if (c.wear >= WEAR_WARN || c.wearPerDay <= 0) return null
  return t + ((WEAR_WARN - c.wear) / c.wearPerDay) * DAY_MS
}

export type Availability = 'available' | 'limited' | 'grounded' | 'in_service'

/**
 * Availability rules: under service → in_service; a flight-critical component at critical wear while
 * docked → grounded (cannot depart); any warning → limited. Ships already in flight are never grounded.
 */
export function assetAvailability(components: Component[], assetId: string, t: number, ship?: Ship): Availability {
  const own = components.filter((c) => c.assetId === assetId)
  if (own.some((c) => (c.inServiceUntil ?? 0) > t)) return 'in_service'
  const docked = !ship || missionStatus(ship, t) !== 'in_transit'
  if (docked && own.some((c) => COMPONENT_SPEC[c.kind].flightCritical && componentLevel(c, t) === 'crit')) return 'grounded'
  if (own.some((c) => componentLevel(c, t) !== 'ok')) return 'limited'
  return 'available'
}

export function assetLevel(components: Component[], assetId: string, t: number): RiskLevel {
  const levels = components.filter((c) => c.assetId === assetId).map((c) => componentLevel(c, t))
  return levels.includes('crit') ? 'crit' : levels.includes('warn') ? 'warn' : 'ok'
}

export function completeService(c: Component, t: number): Component {
  const spec = COMPONENT_SPEC[c.kind]
  return {
    ...c,
    wear: 4,
    lastService: t,
    nextInspection: t + spec.intervalDays * DAY_MS,
    spares: c.wear >= 60 ? Math.max(0, c.spares - 1) : c.spares,
    inServiceUntil: t + c.durationH * HOUR_MS,
    history: [{ at: t, kind: 'service' as const }, ...c.history].slice(0, 30),
  }
}

export function scheduleInspection(c: Component, at: number, now: number): Component {
  return { ...c, nextInspection: at, history: [{ at: now, kind: 'inspection_scheduled' as const, text: String(at) }, ...c.history].slice(0, 30) }
}

export function addNote(c: Component, text: string, now: number): Component {
  return { ...c, history: [{ at: now, kind: 'note' as const, text: text.slice(0, 500) }, ...c.history].slice(0, 30) }
}

export function ageComponents(state: SimState, dtMs: number) {
  const days = dtMs / DAY_MS
  state.components = state.components.map((c) =>
    (c.inServiceUntil ?? 0) > state.time ? c : { ...c, wear: Math.min(100, c.wear + c.wearPerDay * days) },
  )
}
