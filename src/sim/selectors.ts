import type { CommStatus, MissionStatus, RiskLevel, Ship, SimState, Vec2 } from '../types'
import { commDelayMin, commStatus } from './comms'
import { RISK_ORDER, shipRisk, type RiskReason } from './engine'
import { assetAvailability, assetLevel, type Availability } from './maintenance'
import { arrivalTime, departureTime, missionStatus, remainingDistanceAu, shipHeading, shipPosition, shipSpeed } from './trajectory'

export interface ShipView {
  ship: Ship
  status: MissionStatus
  risk: RiskLevel
  reasons: RiskReason[]
  pos: Vec2
  speedKms: number
  heading: number
  departure: number
  eta: number
  remainingMs: number
  remainingAu: number
  comm: CommStatus
  commDelayMin: number
  availability: Availability
  maintLevel: RiskLevel
}

const cache = new WeakMap<SimState, ShipView[]>()

/** Derived per-ship view at the current sim time, computed once per state snapshot. */
export function fleetViews(sim: SimState): ShipView[] {
  const hit = cache.get(sim)
  if (hit) return hit
  const t = sim.time
  const views = sim.ships.map((ship): ShipView => {
    const { level, reasons } = shipRisk(sim, ship)
    const pos = shipPosition(ship, t)
    const status = missionStatus(ship, t)
    return {
      ship,
      status,
      risk: level,
      reasons,
      pos,
      speedKms: status === 'in_transit' ? shipSpeed(ship, t) : 0,
      heading: shipHeading(ship, t),
      departure: departureTime(ship),
      eta: arrivalTime(ship),
      remainingMs: Math.max(0, arrivalTime(ship) - Math.max(t, departureTime(ship))),
      remainingAu: status === 'docked' ? 0 : remainingDistanceAu(ship, t),
      comm: commStatus(sim, ship, t),
      commDelayMin: commDelayMin(pos, t),
      availability: assetAvailability(sim.components, ship.id, t, ship),
      maintLevel: assetLevel(sim.components, ship.id, t),
    }
  })
  cache.set(sim, views)
  return views
}

export const riskCompare = (a: ShipView, b: ShipView) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]
