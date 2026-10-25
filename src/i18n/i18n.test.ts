import { describe, expect, it } from 'vitest'
import { COMPONENT_SPEC } from '../sim/maintenance'
import { QUESTIONS } from '../sim/wellbeing'
import { ar } from './ar'
import { en } from './en'
import { fr } from './fr'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  for (const [name, dict] of Object.entries({ fr, ar })) {
    it(`${name} has every key with matching placeholders`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort())
      for (const k of Object.keys(en) as (keyof typeof en)[]) {
        expect(dict[k].trim().length, k).toBeGreaterThan(0)
        expect(placeholders(dict[k]), `${name}:${k}`).toEqual(placeholders(en[k]))
      }
    })
  }

  it('has every key that is built at runtime', () => {
    const dynamic = [
      ...Object.keys(COMPONENT_SPEC).flatMap((k) => [`comp.${k}`, `step.${k}.1`]),
      ...['wear_crit', 'wear_warn', 'overdue', 'due_soon', 'no_spares', 'ok'].map((r) => `maint.r.${r}`),
      ...['time', 'fuel', 'risk', 'relay', 'docking'].map((f) => `route.f.${f}`),
      ...['current', 'direct', 'via', 'dijkstra', 'delay', 'expedite', 'offset'].map((k) => `route.kind.${k}`),
      ...QUESTIONS.flatMap((q) => [`chat.q.${q}`, ...[0, 1, 2, 3, 4].map((v) => `chat.a.${q}.${v}`)]),
      ...['breathing', 'break', 'relax', 'trusted', 'professional', 'sleep_hygiene'].map((s) => `chat.s.${s}`),
      ...[5, 4, 3, 2, 1].map((g) => `relax.g.${g}`),
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `traffic.step${n}`),
      ...['invalid', 'taken', 'crypto', 'storage'].map((c) => `auth.err.${c}`),
      ...['empty', 'chars', 'length', 'letter', 'digit', 'hyphen', 'duplicate'].map((c) => `ships.err.${c}`),
      ...['service', 'inspection_scheduled', 'note'].map((h) => `maint.h.${h}`),
    ]
    for (const k of dynamic) expect(k in en, k).toBe(true)
  })
})
