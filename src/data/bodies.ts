import type { Body, BodyId } from '../types'

/**
 * Real mean orbital elements (J2000), used with a circular-orbit approximation.
 * Planet positions are good to a few degrees; minor-body longitudes are approximate.
 * This is NOT an ephemeris and must not be used for navigation.
 */
export const BODIES: Body[] = [
  { id: 'sun', a: 0, periodDays: 1, l0: 0, color: '#ffd27a', displayRadius: 7 },
  { id: 'mercury', a: 0.387, periodDays: 87.969, l0: 252.25, color: '#9c948a', displayRadius: 1.4 },
  { id: 'venus', a: 0.723, periodDays: 224.701, l0: 181.98, color: '#e3bb76', displayRadius: 2.2 },
  { id: 'earth', a: 1.0, periodDays: 365.256, l0: 100.46, color: '#4f9dff', displayRadius: 2.4 },
  { id: 'mars', a: 1.524, periodDays: 686.98, l0: 355.45, color: '#e0603a', displayRadius: 1.8 },
  { id: 'vesta', a: 2.362, periodDays: 1325.7, l0: 150, color: '#a7a094', displayRadius: 0.9 },
  { id: 'ceres', a: 2.767, periodDays: 1680.5, l0: 230, color: '#b9b2a6', displayRadius: 1.1 },
  { id: 'jupiter', a: 5.203, periodDays: 4332.59, l0: 34.4, color: '#d8a46c', displayRadius: 4.6 },
  { id: 'saturn', a: 9.537, periodDays: 10759.22, l0: 49.94, color: '#e6cf8f', displayRadius: 4 },
]

export const BODY_BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b])) as Record<BodyId, Body>

export const AU_KM = 149_597_870.7
export const LIGHT_KMS = 299_792.458
export const DAY_MS = 86_400_000
export const HOUR_MS = 3_600_000
/** J2000.0 epoch (2000-01-01T12:00:00Z). */
export const J2000_MS = Date.UTC(2000, 0, 1, 12)
