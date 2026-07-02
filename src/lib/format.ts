import type { Category } from '../types'

/** Per-lab identity colors — desaturated to sit calmly on the dark surface. */
export const LAB_COLOR: Record<string, string> = {
  OpenAI: '#10A37F',
  Anthropic: '#D97757',
  'Google DeepMind': '#4D8DFF',
  Meta: '#0866FF',
  Mistral: '#FA520F',
  xAI: '#C9D2DE',
  DeepSeek: '#7C6CF5',
  'Hugging Face': '#FFB000',
}

export const CAT_COLOR: Record<Category, string> = {
  model: '#4D8DFF',
  feature: '#10A37F',
  api: '#9B8CFF',
  research: '#FFB000',
}

export function labColor(lab: string): string {
  return LAB_COLOR[lab] ?? '#94A0B0'
}

/** Short monogram for the image-less fallback tile. */
export function labMonogram(lab: string): string {
  if (lab === 'Google DeepMind') return 'GD'
  if (lab === 'Hugging Face') return 'HF'
  return lab.charAt(0).toUpperCase()
}

/**
 * Relative timestamp ("3h ago"). Pass `now` (ms) so callers can re-render on
 * a shared ticker instead of freezing the label at first render.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const dt = new Date(iso)
  const sameYear = dt.getFullYear() === new Date(now).getFullYear()
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function fullDate(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

/** True when the item is less than 24 hours old. */
export function isFresh(iso: string, now: number = Date.now()): boolean {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return false
  return now - then < 24 * 60 * 60 * 1000
}
