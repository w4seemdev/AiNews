import type { Category, Lab, Release } from '../types'

const CATEGORIES: ReadonlySet<string> = new Set(['model', 'feature', 'api', 'research'])

function optionalString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

/**
 * Runtime guard for the fetched /releases.json payload. The pipeline writes
 * well-formed data, but the fetch result is untrusted at the type level —
 * this replaces the old blind `as Release[]` cast. Malformed entries are
 * dropped rather than crashing the feed.
 */
export function sanitizeReleases(input: unknown): Release[] {
  if (!Array.isArray(input)) return []

  const out: Release[] = []
  const seen = new Set<string>()

  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>

    if (typeof r.id !== 'string' || r.id === '' || seen.has(r.id)) continue
    if (typeof r.title !== 'string' || r.title.trim() === '') continue
    if (typeof r.lab !== 'string' || r.lab === '') continue
    if (typeof r.date !== 'string' || Number.isNaN(new Date(r.date).getTime())) continue
    if (typeof r.category !== 'string' || !CATEGORIES.has(r.category)) continue

    seen.add(r.id)
    out.push({
      id: r.id,
      lab: r.lab as Lab,
      title: r.title,
      summary: typeof r.summary === 'string' ? r.summary : '',
      date: r.date,
      category: r.category as Category,
      url: optionalString(r.url),
      contextWindow: optionalString(r.contextWindow),
      priceInput: optionalString(r.priceInput),
      priceOutput: optionalString(r.priceOutput),
      benchmark: optionalString(r.benchmark),
      tags: Array.isArray(r.tags)
        ? r.tags.filter((t): t is string => typeof t === 'string')
        : undefined,
      image: optionalString(r.image),
    })
  }
  return out
}
