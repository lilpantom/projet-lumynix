/** mulberry32 step: returns [value in [0,1), next state]. Pure, so seeded runs reproduce exactly. */
export function step(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** Convenience generator over a seed, for scenario construction. */
export function makeRng(seed: number) {
  let s = seed | 0
  const next = () => {
    const [value, n] = step(s)
    s = n
    return value
  }
  return {
    next,
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    int: (lo: number, hi: number) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    get state() {
      return s
    },
  }
}
