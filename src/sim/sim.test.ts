import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../data/bodies'
import { commStatus } from './comms'
import { closestApproach, detectConflicts } from './conflicts'
import { advance, applyRouteCandidate, shipRisk, triggerConflictDrill } from './engine'
import { routeCandidates } from './routing'
import { createScenario } from './scenario'
import { normalizeShipId, validateShipId } from './shipId'
import { arrivalTime, missionStatus, shipPosition } from './trajectory'
import { dist } from './vec'

describe('scenario', () => {
  it('is deterministic for a seed', () => {
    const a = advance(createScenario(7), 10 * HOUR_MS)
    const b = advance(createScenario(7), 10 * HOUR_MS)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('has unique, valid ship ids', () => {
    const s = createScenario()
    const ids = s.ships.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(validateShipId(id, [])).toBeNull()
  })

  it('starts with the planted conflicts', () => {
    const s = createScenario()
    const ids = s.conflicts.map((c) => c.id)
    expect(ids).toContain('ARES-204|KESTREL-19')
    expect(ids).toContain('ORION-315|ZEPHYR-56')
    expect(s.conflicts.find((c) => c.id === 'ORION-315|ZEPHYR-56')!.severity).toBe('crit')
  })

  it('positions are continuous across legs', () => {
    const s = createScenario()
    for (const ship of s.ships) {
      for (let i = 1; i < ship.legs.length; i++) {
        const t = ship.legs[i].t0
        expect(dist(shipPosition(ship, t - 1), shipPosition(ship, t))).toBeLessThan(1e-6)
      }
    }
  })
})

describe('engine', () => {
  it('logs arrivals and fires scripted events', () => {
    const s = advance(createScenario(), 24 * HOUR_MS)
    expect(s.events.some((e) => e.key === 'ev.arrived' && e.params.ship === 'ARES-204')).toBe(true)
    expect(s.events.some((e) => e.key === 'ev.commLost' && e.params.ship === 'ORION-315')).toBe(true)
    expect(missionStatus(s.ships.find((x) => x.id === 'ARES-204')!, s.time)).toBe('docked')
  })

  it('burns fuel in transit only', () => {
    const s0 = createScenario()
    const s1 = advance(s0, 12 * HOUR_MS)
    const f = (s: typeof s0, id: string) => s.ships.find((x) => x.id === id)!.fuel
    expect(f(s1, 'ORION-315')).toBeLessThan(f(s0, 'ORION-315'))
    expect(f(s1, 'LYRA-61')).toBe(f(s0, 'LYRA-61'))
  })

  it('treats docked ships as linked through their port', () => {
    const s = createScenario()
    for (const ship of s.ships.filter((x) => missionStatus(x, s.time) === 'docked')) expect(commStatus(s, ship, s.time)).toBe('nominal')
  })

  it('marks lost telemetry as unknown risk when nothing else is wrong', () => {
    const s = advance(createScenario(), 6 * HOUR_MS)
    const orion = s.ships.find((x) => x.id === 'ORION-315')!
    expect(shipRisk(s, orion).reasons).toContain('comm_lost')
  })
})

describe('routing and resolution', () => {
  it('offers a candidate that resolves the crossing conflict and applying it clears the conflict', () => {
    const s = createScenario()
    const cands = routeCandidates(s, 'ZEPHYR-56')
    expect(cands[0].kind).toBe('current')
    expect(cands[0].conflictWith).toBe('ORION-315')
    const fix = cands.slice(1).find((c) => c.feasible && !c.conflictWith)
    expect(fix).toBeDefined()
    const next = applyRouteCandidate(s, 'ZEPHYR-56', fix!, 'ORION-315|ZEPHYR-56')
    expect(next.conflicts.some((c) => c.id === 'ORION-315|ZEPHYR-56')).toBe(false)
    expect(next.audit[0].outcome).toBe('resolved')
    expect(next.ships.find((x) => x.id === 'ZEPHYR-56')!.fuel).toBeLessThanOrEqual(s.ships.find((x) => x.id === 'ZEPHYR-56')!.fuel)
  })

  it('drill creates a fresh conflict with the target', () => {
    const s = createScenario()
    const r = triggerConflictDrill(s, 'ATLAS-88', s.ships.map((x) => x.id))
    expect(r).not.toBeNull()
    expect(r!.state.conflicts.some((c) => c.a === r!.shipId || c.b === r!.shipId)).toBe(true)
  })

  it('closest approach is symmetric and respects transit windows', () => {
    const s = createScenario()
    const [a, b] = [s.ships[0], s.ships[1]]
    const x = closestApproach(a, b, s.time, s.time + 72 * HOUR_MS)
    const y = closestApproach(b, a, s.time, s.time + 72 * HOUR_MS)
    expect(x?.minSepKm).toBeCloseTo(y!.minSepKm, 0)
    const docked = s.ships.filter((sh) => arrivalTime(sh) < s.time)
    expect(detectConflicts(docked, s.time, s.settings)).toEqual([])
  })
})

describe('ship id rules', () => {
  it('normalizes', () => {
    expect(normalizeShipId('  ares 204 ')).toBe('ARES-204')
    expect(normalizeShipId('nova__42')).toBe('NOVA-42')
  })
  it('validates', () => {
    expect(validateShipId('', [])).toBe('empty')
    expect(validateShipId('ARES', [])).toBe('digit')
    expect(validateShipId('2045', [])).toBe('letter')
    expect(validateShipId('A1', [])).toBe('length')
    expect(validateShipId('AR$-1', [])).toBe('chars')
    expect(validateShipId('-AB1', [])).toBe('hyphen')
    expect(validateShipId('ares-204', ['ARES-204'])).toBe('duplicate')
    expect(validateShipId('ares-204', ['ARES-204'], 'ARES-204')).toBeNull()
    expect(validateShipId('TITAN-07', ['ARES-204'])).toBeNull()
  })
})

import { classifyText, suggestionsFor, wellbeingIndex } from './wellbeing'

describe('well-being check-in', () => {
  it('scores only answered items and allows skipping everything', () => {
    expect(wellbeingIndex({})).toBeNull()
    expect(wellbeingIndex({ mood: 4, stress: null })).toBe(100)
    expect(wellbeingIndex({ mood: 2, sleep: 0 })).toBe(25)
  })
  it('suggests support (never a diagnosis) below thresholds', () => {
    expect(suggestionsFor({ mood: 0, sleep: 0 }, 0)).toContain('professional')
    expect(suggestionsFor({ mood: 4 }, 100)).toEqual(['breathing'])
  })
  it('detects safety language in en/fr/ar', () => {
    expect(classifyText('I want to die')).toBe('safety')
    expect(classifyText("j'ai envie d'en finir")).toBe('safety')
    expect(classifyText('أريد أن أموت')).toBe('safety')
    expect(classifyText('I need a break')).toBe('relax')
    expect(classifyText('all good')).toBe('none')
  })
})
