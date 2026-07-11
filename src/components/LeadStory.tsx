import { useState, type CSSProperties } from 'react'
import { ArrowRight, Bookmark, Check, Link2 } from 'lucide-react'
import type { Release } from '../types'
import { CAT_COLOR, fullDate, isFresh, labColor, labMonogram, relativeTime } from '../lib/format'

interface LeadStoryProps {
  release: Release
  now: number
  isSaved: boolean
  /** True when the story shows illustrative sample data, not real news. */
  isSample: boolean
  onToggleSave: (id: string) => void
  onMarkRead: (id: string) => void
}

export default function LeadStory({ release, now, isSaved, isSample, onToggleSave, onMarkRead }: LeadStoryProps) {
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

  const media = (
    <div className="lead__media">
      {showImage && (
        <img
          className="lead__img"
          src={release.image}
          alt={release.title}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      )}
      {!showImage && (
        <div
          className="lead__monogram"
          aria-hidden="true"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${color} 18%, var(--surface)), var(--surface))`,
            color,
          }}
        >
          {mono}
        </div>
      )}
      <div className="lead__scrim" aria-hidden="true" />
      <div className="lead__badges">
        <span className="lead__featured-badge">Featured</span>
        {isSample && (
          <span className="sample-chip" title="Illustrative sample story — not real news">
            Sample
          </span>
        )}
        {fresh && <span className="new-badge">New</span>}
      </div>
    </div>
  )

  return (
    <article className="lead" aria-label={`Featured: ${release.title}`}>
      {release.url ? (
        <a
          className="lead__link"
          href={release.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onMarkRead(release.id)}
        >
          {media}
        </a>
      ) : (
        media
      )}

      {/* Body */}
      <div className="lead__body">
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
          <span
            className="cat-chip"
            style={{ '--chip-color': catColor } as CSSProperties}
          >
            {release.category}
          </span>
        </div>
        <div className="lead__meta-right">
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
          <time
            className="lead__time"
            dateTime={release.date}
            title={fullDate(release.date)}
          >
            {relativeTime(release.date, now)}
          </time>
        </div>
      </div>

      {/* Headline */}
      <h2 className="lead__headline">
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
      </h2>

      {/* Dek */}
      {release.summary && <p className="lead__dek">{release.summary}</p>}

      {release.url && (
        <a
          className="lead__cta"
          href={release.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onMarkRead(release.id)}
          aria-label={`Read the brief about ${release.title}`}
        >
          Read the brief <ArrowRight size={13} aria-hidden="true" />
        </a>
      )}
      </div>
    </article>
  )
}
