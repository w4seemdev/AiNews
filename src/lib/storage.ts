/**
 * Tiny localStorage helpers for the read/saved sets and UI preferences.
 * Every call is wrapped so private-mode / quota errors never break the feed.
 */

export const SAVED_KEY = 'aipulse:saved'
export const READ_KEY = 'aipulse:read'
export const DENSITY_KEY = 'aipulse:density'

export function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'))
    }
  } catch {
    /* ignore — storage unavailable or corrupt */
  }
  return new Set()
}

export function saveSet(key: string, set: Set<string>): void {
  try {
    // Cap the read-set so it can't grow without bound over months of visits.
    const arr = [...set].slice(-500)
    localStorage.setItem(key, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

export function loadString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
