import { useState, type FormEvent } from 'react'
import { Mail, Send } from 'lucide-react'

interface NewsletterSignupProps {
  /** 'panel' renders inside a sidebar card; 'footer' renders inline in the footer. */
  variant?: 'panel' | 'footer'
}

/**
 * Front-end-only newsletter capture. There is no backend yet, so a submit
 * opens a prefilled mail draft in the visitor's email app — nothing is sent
 * automatically, and the UI never claims a subscription it can't confirm.
 * Swap the handler for a Buttondown/Beehiiv POST when a provider is wired up.
 */
export default function NewsletterSignup({ variant = 'panel' }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  // A draft was opened in the visitor's email app — NOT a confirmed signup.
  const [drafted, setDrafted] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    const subject = encodeURIComponent('Subscribe to AI Pulse')
    const body = encodeURIComponent(`Please add ${trimmed} to the AI Pulse daily briefing.`)
    window.location.href = `mailto:waseemabufares@gmail.com?subject=${subject}&body=${body}`
    setDrafted(true)
  }

  return (
    <div className={`newsletter newsletter--${variant}`}>
      <h2 className="newsletter__heading">
        <span className="newsletter__icon-tile" aria-hidden="true">
          <Mail size={14} />
        </span>
        The daily briefing
      </h2>
      <p className="newsletter__copy">
        Every model, feature, and paper from the top labs — one calm email, every morning.
      </p>
      {drafted ? (
        <p className="newsletter__done" role="status">
          <Send size={14} aria-hidden="true" />
          <span>
            A prefilled request just opened in your email app — press send there
            to finish subscribing. Nothing was sent automatically.
          </span>
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
      <p className="newsletter__fine">
        Subscribing opens your email app. Free, unsubscribe anytime.
      </p>
    </div>
  )
}
