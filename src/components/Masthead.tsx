export default function Masthead() {
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
    <header className="masthead">
      <div className="masthead__inner">
        <div className="masthead__brand">
          <h1 className="masthead__wordmark">
            <span className="masthead__dot" aria-hidden="true" />
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
