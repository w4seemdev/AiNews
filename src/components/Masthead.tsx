import { useEffect, useState } from 'react'

export default function Masthead() {
  // Scroll elevation: border + shadow appear only after the page scrolls.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const now = new Date()
  const today = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  // Machine-readable date for the <time> element (local calendar day).
  const isoDay = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

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
          <div className="masthead__live" aria-label="Updated daily">
            <span className="masthead__live-dot" aria-hidden="true" />
            Updated daily
          </div>
        </div>
      </div>
    </header>
  )
}
