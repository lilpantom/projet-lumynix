/** Ship identifier rules: 3–12 chars of A–Z, 0–9 and single hyphens, with ≥1 letter and ≥1 digit, unique. */

export type ShipIdError = 'empty' | 'chars' | 'length' | 'letter' | 'digit' | 'hyphen' | 'duplicate'

/** Canonical form: trimmed, upper-case, internal whitespace/underscores become a single hyphen. */
export function normalizeShipId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

export function validateShipId(raw: string, existingIds: readonly string[], currentId?: string): ShipIdError | null {
  const id = normalizeShipId(raw)
  if (!id) return 'empty'
  if (!/^[A-Z0-9-]+$/.test(id)) return 'chars'
  if (id.length < 3 || id.length > 12) return 'length'
  if (id.startsWith('-') || id.endsWith('-')) return 'hyphen'
  if (!/[A-Z]/.test(id)) return 'letter'
  if (!/[0-9]/.test(id)) return 'digit'
  const taken = existingIds.some((e) => normalizeShipId(e) === id && normalizeShipId(e) !== (currentId && normalizeShipId(currentId)))
  if (taken) return 'duplicate'
  return null
}
