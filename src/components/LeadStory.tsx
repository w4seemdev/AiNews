import { ArrowRight } from 'lucide-react'
import type { Release, Category } from '../types'

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

export const CAT_LABEL: Record<Category, string> = {
  model: 'model',
  feature: 'feature',
  api: 'api',
  research: 'research',
}

export function labColor(lab: string): string {
  return LAB_COLOR[lab] ?? '#8A95A4'
}

export function labMonogram(lab: string): string {
  // Return first meaningful word's first letter, uppercase
  return lab.replace('Google DeepMind', 'GD').charAt(0).toUpperCase()
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  if (h < 48) return 'Yesterday'
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

// ----------------------------------------------------------------

interface LeadStoryProps {
  release: Release
}

export default function LeadStory({ release }: LeadStoryProps) {
  const color = labColor(release.lab)
  const mono = labMonogram(release.lab)
  const catColor = CAT_COLOR[release.category]
  const catLabel = CAT_LABEL[release.category]

  const Wrapper = release.url ? 'a' : 'div'
  const linkProps = release.url
    ? { href: release.url, target: '_blank', rel: 'noopener noreferrer' }
    : {}

  return (
    <article>
      <Wrapper
        className="lead"
        aria-label={`Featured: ${release.title}`}
        {...(linkProps as any)}
      >
        {/* 16:9 media */}
        <div className="lead__media">
          {release.image ? (
            <img
              className="lead__img"
              src={release.image}
              alt={release.title}
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
                const fallback = t.parentElement?.querySelector('.lead__monogram') as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}

          {/* Monogram fallback — always rendered, hidden when image loads */}
          <div
            className="lead__monogram"
            aria-hidden="true"
            style={{
              display: release.image ? 'none' : 'flex',
              background: `linear-gradient(145deg, color-mix(in srgb, ${color} 18%, #0D1117), #0D1117)`,
              color,
            }}
          >
            {mono}
          </div>
        </div>

        {/* Meta line */}
        <div className="lead__meta">
          <div className="lead__meta-left">
            <span
              className="source-dot"
              style={{ background: color }}
              aria-hidden="true"
            />
            <span className="source-name">{release.lab}</span>
            <span className="meta-sep" aria-hidden="true">·</span>
            <span className="cat-label" style={{ color: catColor }}>{catLabel}</span>
            <span className="lead__featured-badge">Featured</span>
          </div>
          <time
            className="lead__time"
            dateTime={release.date}
            title={fullDate(release.date)}
          >
            {relativeTime(release.date)}
          </time>
        </div>

        {/* Headline */}
        <h1 className="lead__headline">{release.title}</h1>

        {/* Dek */}
        <p className="lead__dek">{release.summary}</p>

        {release.url && (
          <span className="lead__cta" aria-label={`Read the brief about ${release.title}`}>
            Read the brief <ArrowRight size={13} />
          </span>
        )}
      </Wrapper>
    </article>
  )
}
