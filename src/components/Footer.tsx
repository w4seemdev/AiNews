import { Rss } from 'lucide-react'
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
              <span className="masthead__dot" aria-hidden="true" />
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
                Contact
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
        </div>
      </div>
    </footer>
  )
}
