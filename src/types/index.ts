/** Heliocentric ecliptic position or vector, in astronomical units (AU). */
export interface Vec2 {
  x: number
  y: number
}

export type Locale = 'en' | 'fr' | 'ar'
export type Theme = 'dark' | 'light'
export type RiskLevel = 'ok' | 'warn' | 'crit' | 'unknown'

export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'ceres' | 'vesta' | 'jupiter' | 'saturn'

export interface Body {
  id: BodyId
  /** Semi-major axis, AU. */
  a: number
  /** Orbital period, days. */
  periodDays: number
  /** Mean longitude at J2000, degrees. */
  l0: number
  color: string
  displayRadius: number
}

export type NodeKind = 'port' | 'relay'

/** A fictional settlement, orbital station or relay, anchored to a real body. */
export interface SpaceNode {
  id: string
  name: string
  kind: NodeKind
  body: BodyId
  /** Angular offset along the body's orbit, degrees (±60 = Lagrange L4/L5). */
  offsetDeg: number
  /** Docking berths (ports only). */
  berths: number
}

export type MissionType = 'cargo' | 'passenger' | 'science' | 'mining' | 'medical'
export type Priority = 'low' | 'normal' | 'high' | 'critical'
export type CargoCategory = 'supplies' | 'ore' | 'water' | 'passengers' | 'equipment' | 'medical' | 'research'
export type CommStatus = 'nominal' | 'degraded' | 'lost'
export type MissionStatus = 'scheduled' | 'in_transit' | 'docked'

/** A quadratic Bézier transfer leg between fixed heliocentric points. Times are sim ms. */
export interface Leg {
  p0: Vec2
  c: Vec2
  p1: Vec2
  t0: number
  t1: number
  /** Node the leg ends at, if it is a waypoint or the destination. */
  viaNodeId?: string
}

export interface Ship {
  id: string
  name: string
  missionType: MissionType
  cargo: CargoCategory
  priority: Priority
  originId: string
  destinationId: string
  legs: Leg[]
  /** Fuel / energy budget, percent. */
  fuel: number
  /** Cruise consumption, percent per sim day. */
  burnPerDay: number
  crewCount: number
  /** Scripted relay/transponder fault until this sim time, if any. */
  commFaultUntil?: number
}

export type ComponentKind =
  | 'reactor_pump'
  | 'engine_gimbal'
  | 'scrubber'
  | 'antenna'
  | 'shielding'
  | 'docking_adapter'
  | 'power_bus'
  | 'radiator'
  | 'docking_arm'
  | 'relay_transmitter'

export interface MaintenanceEntry {
  at: number
  kind: 'service' | 'inspection_scheduled' | 'note'
  text?: string
}

export interface Component {
  id: string
  assetId: string
  assetKind: 'ship' | 'node'
  kind: ComponentKind
  /** Simulated wear, 0 (new) – 100 (end of rated life). */
  wear: number
  /** Simulated wear gain per sim day. */
  wearPerDay: number
  lastService: number
  nextInspection: number
  spares: number
  /** Estimated service duration, hours. */
  durationH: number
  /** While being serviced, the asset is unavailable until this time. */
  inServiceUntil?: number
  history: MaintenanceEntry[]
}

export type EventSeverity = 'info' | 'warn' | 'crit'

export interface SimEvent {
  id: string
  at: number
  severity: EventSeverity
  /** Translation key + params so the log re-renders in the active language. */
  key: string
  params: Record<string, string | number>
  shipId?: string
  read: boolean
}

export interface Conflict {
  /** Stable pair key: "A|B" with A < B. */
  id: string
  a: string
  b: string
  /** Time of closest approach, sim ms. */
  tca: number
  minSepKm: number
  relSpeedKms: number
  severity: 'warn' | 'crit'
}

export interface TelemetrySample {
  t: number
  speedKms: number
  fuel: number
  commDelayMin: number
}

export interface AuditEntry {
  id: string
  at: number
  shipId: string
  conflictId?: string
  action: string
  actionParams?: Record<string, string | number>
  detail: string
  outcome: 'resolved' | 'reduced' | 'unresolved' | 'applied'
}

export interface SimSettings {
  /** Conflict separation minimum, km. */
  thresholdKm: number
  /** Conflict prediction horizon, hours. */
  horizonH: number
}

export interface SimState {
  version: number
  seed: number
  rng: number
  /** Simulated time, ms since Unix epoch. */
  time: number
  startTime: number
  ships: Ship[]
  components: Component[]
  events: SimEvent[]
  conflicts: Conflict[]
  telemetry: Record<string, TelemetrySample[]>
  audit: AuditEntry[]
  relayOutages: Record<string, number>
  /** Scripted events not yet fired. */
  pendingScript: ScriptedEvent[]
  nextSampleAt: number
  eventSeq: number
  settings: SimSettings
}

export type ScriptedEvent =
  | { at: number; type: 'comm_fault'; shipId: string; hours: number }
  | { at: number; type: 'relay_outage'; nodeId: string; hours: number }
  | { at: number; type: 'wear_spike'; componentId: string; amount: number }
