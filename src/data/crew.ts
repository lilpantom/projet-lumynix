import { DAY_MS } from './bodies'
import { makeRng } from '../sim/random'

/**
 * FICTIONAL, SYNTHETIC crew records for demonstration only. Identifiers are pseudonymous; there are
 * no names and nothing here is a medical record. Generated deterministically from the ship id.
 */
export type CrewRole = 'commander' | 'pilot' | 'engineer' | 'medic' | 'specialist'

export interface CrewMember {
  id: string
  shipId: string
  role: CrewRole
  /** Self-reported sleep, hours, last 14 days (oldest first). */
  sleep: number[]
  /** Self-reported stress 1 (low) – 5 (high), at each past check-in (oldest first). */
  stress: number[]
  /** Simulated resting heart rate, bpm, last 14 days. Not a measurement. */
  heartRate: number[]
  checkIns: number[]
  nextCheckIn: number
}

const ROLES: CrewRole[] = ['commander', 'pilot', 'engineer', 'medic', 'specialist', 'specialist']

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function crewForShip(shipId: string, count: number, now: number): CrewMember[] {
  const rng = makeRng(hash(shipId))
  return Array.from({ length: count }, (_, i) => {
    const baseSleep = rng.range(5.8, 7.8)
    const baseStress = rng.range(1.5, 3.6)
    const baseHr = rng.range(56, 74)
    const lastCheck = now - rng.range(0.2, 9) * DAY_MS
    return {
      id: `CW-${shipId.replace(/-/g, '').slice(0, 6)}-${String(i + 1).padStart(2, '0')}`,
      shipId,
      role: ROLES[i % ROLES.length],
      sleep: Array.from({ length: 14 }, () => Math.round((baseSleep + rng.range(-1.2, 1)) * 10) / 10),
      stress: Array.from({ length: 6 }, () => Math.max(1, Math.min(5, Math.round(baseStress + rng.range(-1, 1))))),
      heartRate: Array.from({ length: 14 }, () => Math.round(baseHr + rng.range(-4, 4))),
      checkIns: Array.from({ length: 6 }, (_, k) => lastCheck - (5 - k) * 7 * DAY_MS),
      nextCheckIn: lastCheck + 7 * DAY_MS,
    }
  })
}
