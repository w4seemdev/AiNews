import { memo, useState, type CSSProperties } from 'react'
import { Bookmark, Check, Link2 } from 'lucide-react'
import type { Release } from '../types'
import { labColor, labMonogram, CAT_COLOR, relativeTime, fullDate, isFresh } from '../lib/format'

interface NewsRowProps {
  release: Release
  now: number
  isSaved: boolean
  isRead: boolean
  /** True when the row shows illustrative sample data, not a real story. */
  isSample: boolean
  onToggleSave: (id: string) => void
  onMarkRead: (id: string) => void
}

function SpecStrip({ release }: { release: Release }) {
  const specs: string[] = []
  if (release.contextWindow) specs.push(`ctx ${release.contextWindow}`)
  if (release.priceInput) specs.push(`in ${release.priceInput}`)
  if (release.priceOutput) specs.push(`out ${release.priceOutput}`)
  if (release.benchmark) specs.push(release.benchmark)
  if (specs.length === 0) return null
  return (
    <div className="spec-strip" aria-label="Model specs">
      {specs.map((s) => (
        <span className="spec-strip__item" key={s}>{s}</span>
      ))}
    </div>
  )
}

function NewsRow({ release, now, isSaved, isRead, isSample, onToggleSave, onMarkRead }: NewsRowProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const color = labColor(release.lab)
  const mono = labMonogram(release.lab)
  const catColor = CAT_COLOR[release.category]
  const showImage = Boolean(release.image) && !imgFailed
  const fresh = isFresh(release.date, now)

  async function handleCopy() {
    if (!release.url) return
    try {
      await navigator.clipboard.writeText(release.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <article className={'news-row' + (isRead ? ' is-read' : '')}>
      {/* Thumbnail */}
      <div className="news-row__thumb" aria-hidden="true">
        {showImage && (
          <img
            className="news-row__thumb-img"
            src={release.image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        )}
        {!showImage && (
          <div
            className="news-row__thumb-mono"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${color} 16%, var(--surface-raised)), var(--surface-raised))`,
              color,
            }}
          >
            {mono}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="news-row__body">
        {/* Meta row */}
        <div className="news-row__meta">
          <div className="news-row__meta-left">
            <span className="source-dot" style={{ background: color }} aria-hidden="true" />
            <span className="source-name">{release.lab}</span>
            <span className="meta-sep" aria-hidden="true">·</span>
            <span
              className="cat-chip"
              style={{ '--chip-color': catColor } as CSSProperties}
            >
              {release.category}
            </span>
            {isSample && (
              <span className="sample-chip" title="Illustrative sample story — not real news">
                Sample
              </span>
            )}
            {fresh && <span className="new-badge">New</span>}
          </div>
          <time
            className="news-row__time"
            dateTime={release.date}
            title={fullDate(release.date)}
          >
            {relativeTime(release.date, now)}
          </time>
        </div>

        {/* Headline */}
        <h3 className="news-row__headline">
          {release.url ? (
            <a
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onMarkRead(release.id)}
            >
              {release.title}
            </a>
          ) : (
            release.title
          )}
        </h3>

        {/* Dek */}
        {release.summary && <p className="news-row__dek">{release.summary}</p>}

        <SpecStrip release={release} />
      </div>

      {/* Actions */}
      <div className="news-row__actions">
        <button
          type="button"
          className={'row-action' + (isSaved ? ' is-active' : '')}
          onClick={() => onToggleSave(release.id)}
          aria-pressed={isSaved}
          aria-label={isSaved ? `Remove "${release.title}" from saved` : `Save "${release.title}" for later`}
          title={isSaved ? 'Remove from saved' : 'Save for later'}
        >
          <Bookmark size={14} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        {release.url && (
          <button
            type="button"
            className={'row-action' + (copied ? ' is-active is-copied' : '')}
            onClick={handleCopy}
            aria-label={copied ? 'Link copied' : `Copy link to "${release.title}"`}
            title={copied ? 'Copied!' : 'Copy link'}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
    </article>
  )
}

export default memo(NewsRow)
