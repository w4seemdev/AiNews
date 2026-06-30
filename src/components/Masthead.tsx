export default function Masthead() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <header className="masthead" role="banner">
      <div className="masthead__inner">
        <div className="masthead__brand">
          <div className="masthead__wordmark">
            <span className="masthead__dot" aria-hidden="true" />
            AI Pulse
          </div>
          <span className="masthead__tagline">The AI newswire</span>
        </div>

        <div className="masthead__right">
          <time className="masthead__date">{today}</time>
          <div className="masthead__live" aria-label="Updated daily">
            <span className="masthead__live-dot" aria-hidden="true" />
            Updated daily
          </div>
        </div>
      </div>
    </header>
  )
}
