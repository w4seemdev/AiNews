import { ArrowUp, Mail, Rss } from 'lucide-react'
import { LAB_COLOR } from '../lib/format'
import NewsletterSignup from './NewsletterSignup'

const NEWSROOMS: { lab: string; url: string }[] = [
  { lab: 'OpenAI', url: 'https://openai.com/news/' },
  { lab: 'Anthropic', url: 'https://www.anthropic.com/news' },
  { lab: 'Google DeepMind', url: 'https://deepmind.google/discover/blog/' },
  { lab: 'Meta', url: 'https://ai.meta.com/blog/' },
  { lab: 'Mistral', url: 'https://mistral.ai/news/' },
  { lab: 'xAI', url: 'https://x.ai/news' },
  { lab: 'DeepSeek', url: 'https://www.deepseek.com/' },
  { lab: 'Hugging Face', url: 'https://huggingface.co/blog' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__grid">
          {/* About */}
          <div className="footer__col footer__col--about">
            <div className="footer__brand">
              <span className="footer__logo" aria-hidden="true">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ stroke: 'var(--bg)' }}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" />
                </svg>
              </span>
              AI Pulse
            </div>
            <p className="footer__about">
              An independent newswire tracking every model, feature, API, and research
              drop from the top AI labs — refreshed daily from their official feeds,
              presented without the noise.
            </p>
            <div className="footer__feeds">
              <a className="footer__feed-link" href="/releases.json">
                <Rss size={13} aria-hidden="true" /> JSON feed
              </a>
              <a className="footer__feed-link" href="mailto:waseemabufares@gmail.com">
                <Mail size={13} aria-hidden="true" /> Contact
              </a>
            </div>
          </div>

          {/* Sources */}
          <div className="footer__col">
            <h2 className="footer__title">Sources</h2>
            <ul className="footer__source-list">
              {NEWSROOMS.map(({ lab, url }) => (
                <li key={lab}>
                  <a
                    className="footer__source-link"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span
                      className="source-dot"
                      style={{ background: LAB_COLOR[lab] }}
                      aria-hidden="true"
                    />
                    {lab}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="footer__col footer__col--newsletter">
            <NewsletterSignup variant="footer" />
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {year} AI Pulse. Headlines and summaries link to the original announcements.</span>
          <button
            type="button"
            className="footer__top-btn"
            onClick={() => {
              const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
              window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
            }}
          >
            <ArrowUp size={13} aria-hidden="true" />
            Back to top
          </button>
        </div>
      </div>
    </footer>
  )
}
