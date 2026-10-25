/** localStorage access that tolerates unavailable storage and invalid JSON. All keys are namespaced. */
const NS = 'orbitflow:'

export function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(NS + key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(NS + key)
  } catch {
    /* ignore */
  }
}

export function clearAll() {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(NS))
      .forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

export function storageAvailable(): boolean {
  try {
    window.localStorage.setItem(NS + '__probe', '1')
    window.localStorage.removeItem(NS + '__probe')
    return true
  } catch {
    return false
  }
}
