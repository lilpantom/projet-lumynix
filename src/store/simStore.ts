import { create } from 'zustand'
import * as engine from '../sim/engine'
import type { RouteCandidate } from '../sim/routing'
import { createScenario, DEFAULT_SEED, STATE_VERSION } from '../sim/scenario'
import type { Conflict, SimSettings, SimState } from '../types'
import { readJson, removeKey, writeJson } from '../utils/storage'

/** Simulated minutes per real second. */
export const SPEEDS = [1, 10, 60, 360, 1440] as const
export type Speed = (typeof SPEEDS)[number]
export const TICK_MS = 1000

interface SimStore {
  sim: SimState
  running: boolean
  speed: Speed
  /** performance.now() at the last tick, used by the 3D scene to interpolate between ticks. */
  lastTickWall: number
  loadError: boolean
  tick: () => void
  setRunning: (r: boolean) => void
  setSpeed: (s: Speed) => void
  reset: (seed?: number) => void
  applyRoute: (shipId: string, cand: RouteCandidate, conflictId?: string) => void
  acknowledge: (c: Conflict) => void
  addShip: (data: engine.NewShipInput) => void
  updateShip: (oldId: string, patch: Parameters<typeof engine.updateShip>[2]) => void
  drill: (targetId: string) => string | null
  setSettings: (s: SimSettings) => void
  service: (componentId: string) => void
  schedule: (componentId: string, inHours: number) => void
  note: (componentId: string, text: string) => void
  markRead: (ids?: string[]) => void
}

/** Minimal structural validation of a persisted snapshot; anything off means a fresh scenario. */
function isSnapshot(v: unknown): v is SimState {
  const s = v as SimState
  return (
    !!s &&
    s.version === STATE_VERSION &&
    typeof s.time === 'number' &&
    Array.isArray(s.ships) &&
    s.ships.every((x) => typeof x.id === 'string' && Array.isArray(x.legs)) &&
    Array.isArray(s.components) &&
    Array.isArray(s.events) &&
    Array.isArray(s.conflicts) &&
    typeof s.settings?.thresholdKm === 'number'
  )
}

function loadInitial(): { sim: SimState; loadError: boolean } {
  const raw = readJson('sim')
  if (raw === null) return { sim: createScenario(), loadError: false }
  if (isSnapshot(raw)) return { sim: raw, loadError: false }
  removeKey('sim')
  return { sim: createScenario(), loadError: true }
}

const savedSpeed = readJson('speed')
const initial = loadInitial()

export const useSim = create<SimStore>((set, get) => {
  const mutate = (fn: (s: SimState) => SimState) => set({ sim: fn(get().sim) })
  return {
    sim: initial.sim,
    loadError: initial.loadError,
    running: true,
    speed: SPEEDS.includes(savedSpeed as Speed) ? (savedSpeed as Speed) : 60,
    lastTickWall: performance.now(),
    tick: () => set((st) => ({ sim: engine.advance(st.sim, st.speed * 60_000), lastTickWall: performance.now() })),
    setRunning: (running) => set({ running, lastTickWall: performance.now() }),
    setSpeed: (speed) => {
      writeJson('speed', speed)
      set({ speed })
    },
    reset: (seed) => set({ sim: createScenario(seed ?? get().sim.seed ?? DEFAULT_SEED, get().sim.settings), lastTickWall: performance.now() }),
    applyRoute: (shipId, cand, conflictId) => mutate((s) => engine.applyRouteCandidate(s, shipId, cand, conflictId)),
    acknowledge: (c) => mutate((s) => engine.acknowledgeConflict(s, c)),
    addShip: (data) => mutate((s) => engine.addShip(s, data)),
    updateShip: (oldId, patch) => mutate((s) => engine.updateShip(s, oldId, patch)),
    drill: (targetId) => {
      const r = engine.triggerConflictDrill(get().sim, targetId, get().sim.ships.map((x) => x.id))
      if (!r) return null
      set({ sim: r.state })
      return r.shipId
    },
    setSettings: (settings) => mutate((s) => engine.updateSettings(s, settings)),
    service: (id) => mutate((s) => engine.serviceComponent(s, id)),
    schedule: (id, h) => mutate((s) => engine.scheduleComponentInspection(s, id, h)),
    note: (id, text) => mutate((s) => engine.noteComponent(s, id, text)),
    markRead: (ids) => mutate((s) => engine.markEventsRead(s, ids)),
  }
})

// Persist the simulation snapshot at most every 5 s (local demo state only; nothing sensitive).
let saveTimer: number | undefined
let persist = true
useSim.subscribe((st, prev) => {
  if (!persist || st.sim === prev.sim || saveTimer !== undefined) return
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined
    if (persist) writeJson('sim', useSim.getState().sim)
  }, 5000)
})
window.addEventListener('beforeunload', () => persist && writeJson('sim', useSim.getState().sim))

/** Stops all further snapshot writes (used before clearing local data). */
export function disablePersistence() {
  persist = false
  window.clearTimeout(saveTimer)
}
