import { AU_KM, HOUR_MS } from '../data/bodies'
import type { Conflict, Ship, SimSettings } from '../types'
import { arrivalTime, departureTime, shipPosition, shipVelocity } from './trajectory'
import { dist, len, sub } from './vec'

/**
 * Simplified, explainable conflict model (decision-support demo, not a validated collision predictor):
 * for each pair of ships that are both in transit during the prediction horizon, sample their
 * separation, refine the minimum, and flag a conflict when it falls below the separation threshold.
 * Severity is critical below 35% of the threshold.
 */
export const CRIT_FRACTION = 0.35
const SAMPLES = 96

export interface Approach {
  tca: number
  minSepKm: number
  relSpeedKms: number
}

const sepKm = (a: Ship, b: Ship, t: number) => dist(shipPosition(a, t), shipPosition(b, t)) * AU_KM

export function closestApproach(a: Ship, b: Ship, from: number, to: number): Approach | null {
  const lo = Math.max(from, departureTime(a), departureTime(b))
  const hi = Math.min(to, arrivalTime(a), arrivalTime(b))
  if (hi <= lo) return null
  const dt = (hi - lo) / SAMPLES
  let bestT = lo
  let best = Infinity
  for (let i = 0; i <= SAMPLES; i++) {
    const t = lo + i * dt
    const d = sepKm(a, b, t)
    if (d < best) {
      best = d
      bestT = t
    }
  }
  // Golden-section refinement around the sampled minimum.
  let x0 = Math.max(lo, bestT - dt)
  let x1 = Math.min(hi - 1, bestT + dt)
  const g = 0.618034
  for (let i = 0; i < 30 && x1 - x0 > 1000; i++) {
    const m1 = x1 - g * (x1 - x0)
    const m2 = x0 + g * (x1 - x0)
    if (sepKm(a, b, m1) < sepKm(a, b, m2)) x1 = m2
    else x0 = m1
  }
  const tRefined = (x0 + x1) / 2
  const dRefined = sepKm(a, b, tRefined)
  const tca = dRefined < best ? tRefined : bestT
  return {
    tca,
    minSepKm: Math.min(best, dRefined),
    relSpeedKms: len(sub(shipVelocity(a, tca), shipVelocity(b, tca))),
  }
}

export const pairId = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export function severityFor(minSepKm: number, settings: SimSettings): Conflict['severity'] {
  return minSepKm < settings.thresholdKm * CRIT_FRACTION ? 'crit' : 'warn'
}

export function detectConflicts(ships: Ship[], now: number, settings: SimSettings): Conflict[] {
  const to = now + settings.horizonH * HOUR_MS
  const out: Conflict[] = []
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const ap = closestApproach(ships[i], ships[j], now, to)
      if (!ap || ap.minSepKm >= settings.thresholdKm) continue
      const [a, b] = ships[i].id < ships[j].id ? [ships[i].id, ships[j].id] : [ships[j].id, ships[i].id]
      out.push({ id: pairId(a, b), a, b, ...ap, severity: severityFor(ap.minSepKm, settings) })
    }
  }
  return out.sort((x, y) => x.tca - y.tca)
}

/** Worst predicted approach of one (possibly hypothetical) ship against all other traffic. */
export function worstApproach(ship: Ship, others: Ship[], now: number, settings: SimSettings) {
  const to = now + settings.horizonH * HOUR_MS
  let worst: (Approach & { otherId: string }) | null = null
  for (const o of others) {
    if (o.id === ship.id) continue
    const ap = closestApproach(ship, o, now, to)
    if (ap && (!worst || ap.minSepKm < worst.minSepKm)) worst = { ...ap, otherId: o.id }
  }
  return worst
}
