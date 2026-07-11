import { useEffect, useState } from 'react'
import { fullDate, relativeTime } from '../lib/format'

/** Data older than this is visually flagged as stale (pulse stops, badge greys out). */
const STALE_AFTER_MS = 36 * 60 * 60 * 1000

interface MastheadProps {
  /**
   * ISO timestamp of the last successful data refresh (meta.json generatedAt,
   * or the newest item date as a fallback). Null while loading or when only
   * sample data is available — the badge is hidden rather than showing a claim
   * we can't back.
   */
  updatedAt: string | null
}

export default function Masthead({ updatedAt }: MastheadProps) {
  // Scroll elevation: border + shadow appear only after the page scrolls.
  const [scrolled, setScrolled] = useState(false)
  // Shared ticker so the "Updated Xh ago" label stays honest in a long-open tab.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const nowDate = new Date(now)
  const today = nowDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  // Machine-readable date for the <time> element (local calendar day).
  const isoDay = [
    nowDate.getFullYear(),
    String(nowDate.getMonth() + 1).padStart(2, '0'),
    String(nowDate.getDate()).padStart(2, '0'),
  ].join('-')

  const updatedMs = updatedAt ? new Date(updatedAt).getTime() : NaN
  const stale = Number.isFinite(updatedMs) && now - updatedMs > STALE_AFTER_MS

  return (
    <header className={`masthead${scrolled ? ' is-scrolled' : ''}`}>
      <div className="masthead__inner">
        <div className="masthead__brand">
          <h1 className="masthead__wordmark">
            <span className="masthead__logo" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#020617"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" />
              </svg>
            </span>
            AI Pulse
          </h1>
          <p className="masthead__tagline">The AI newswire</p>
        </div>

        <div className="masthead__right">
          <time className="masthead__date" dateTime={isoDay}>{today}</time>
          {updatedAt && (
            <div
              className={'masthead__live' + (stale ? ' masthead__live--stale' : '')}
              title={fullDate(updatedAt)}
            >
              <span className="masthead__live-dot" aria-hidden="true" />
              Updated {relativeTime(updatedAt, now)}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
