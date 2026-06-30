import type { Release } from '../types'
import { labColor, labMonogram, CAT_COLOR, CAT_LABEL, relativeTime, fullDate } from './LeadStory'

interface NewsRowProps {
  release: Release
}

export default function NewsRow({ release }: NewsRowProps) {
  const color = labColor(release.lab)
  const mono = labMonogram(release.lab)
  const catColor = CAT_COLOR[release.category]
  const catLabel = CAT_LABEL[release.category]

  const inner = (
    <>
      {/* Thumbnail */}
      <div className="news-row__thumb" aria-hidden="true">
        {release.image ? (
          <img
            className="news-row__thumb-img"
            src={release.image}
            alt=""
            onError={(e) => {
              const t = e.currentTarget
              t.style.display = 'none'
              const fallback = t.parentElement?.querySelector('.news-row__thumb-mono') as HTMLElement | null
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}

        <div
          className="news-row__thumb-mono"
          style={{
            display: release.image ? 'none' : 'flex',
            background: `linear-gradient(145deg, color-mix(in srgb, ${color} 16%, #141A22), #141A22)`,
            color,
          }}
        >
          {mono}
        </div>
      </div>

      {/* Body */}
      <div className="news-row__body">
        {/* Meta row */}
        <div className="news-row__meta">
          <div className="news-row__meta-left">
            <span
              className="source-dot"
              style={{ background: color }}
              aria-hidden="true"
            />
            <span className="source-name">{release.lab}</span>
            <span className="meta-sep" aria-hidden="true">·</span>
            <span className="cat-label" style={{ color: catColor }}>{catLabel}</span>
          </div>
          <time
            className="news-row__time"
            dateTime={release.date}
            title={fullDate(release.date)}
          >
            {relativeTime(release.date)}
          </time>
        </div>

        {/* Headline */}
        <div className="news-row__headline">{release.title}</div>

        {/* Dek */}
        {release.summary && (
          <p className="news-row__dek">{release.summary}</p>
        )}
      </div>
    </>
  )

  if (release.url) {
    return (
      <a
        className="news-row"
        href={release.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={release.title}
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="news-row" role="article" aria-label={release.title}>
      {inner}
    </div>
  )
}
