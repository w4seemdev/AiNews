import { useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'

interface NewsletterSignupProps {
  /** 'panel' renders inside a sidebar card; 'footer' renders inline in the footer. */
  variant?: 'panel' | 'footer'
}

/**
 * Front-end-only newsletter capture. There is no backend yet, so a submit
 * opens a prefilled mail draft and flips to a success state. Swap the
 * handler for a Buttondown/Beehiiv POST when a provider is wired up.
 */
export default function NewsletterSignup({ variant = 'panel' }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    const subject = encodeURIComponent('Subscribe to AI Pulse')
    const body = encodeURIComponent(`Please add ${trimmed} to the AI Pulse daily briefing.`)
    window.location.href = `mailto:waseemabufares@gmail.com?subject=${subject}&body=${body}`
    setDone(true)
  }

  return (
    <div className={`newsletter newsletter--${variant}`}>
      <h2 className="newsletter__heading">
        <Mail size={14} aria-hidden="true" />
        The daily briefing
      </h2>
      <p className="newsletter__copy">
        Every model, feature, and paper from the top labs — one calm email, every morning.
      </p>
      {done ? (
        <p className="newsletter__done" role="status">
          Almost there — send the email that just opened and you&rsquo;re on the list.
        </p>
      ) : (
        <form className="newsletter__form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor={`newsletter-email-${variant}`}>
            Email address
          </label>
          <input
            id={`newsletter-email-${variant}`}
            className="newsletter__input"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="newsletter__btn">
            Subscribe
          </button>
        </form>
      )}
      <p className="newsletter__fine">Free. No spam, unsubscribe anytime.</p>
    </div>
  )
}
