// scripts/refresh-news.mjs
//
// Collector + Publisher stage of the daily AI-news refresh pipeline.
//
// Fetches RSS feeds from AI labs / community sources, maps each entry to the
// card shape consumed by the website (see src/types.ts -> Release), drops
// marketing/event posts, dedupes, sorts newest-first, caps per-lab then
// globally, optionally runs an enrichment hook, and writes three outputs:
//   public/releases.json — the card array consumed by the frontend (shape
//                          unchanged: a top-level JSON array)
//   public/meta.json     — { generatedAt, labs: { <lab>: <count> } } freshness
//                          metadata (sibling file, so the frontend contract
//                          for releases.json is untouched)
//   public/feed.xml      — RSS 2.0 feed of the same items
//
// Run with:  npm run refresh   (= node scripts/refresh-news.mjs)
//
// Requirements: Node 18+ (for global fetch) and the `rss-parser` package.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import Parser from 'rss-parser'

// ---------------------------------------------------------------------------
// SOURCES
//
// EDIT THIS LIST FREELY. Each entry must have:
//   feed — a public RSS/Atom URL
//   lab  — MUST be one of the allowed Lab values in src/types.ts
//
// Lab values: 'OpenAI' | 'Anthropic' | 'Google DeepMind' | 'Meta' |
//             'Mistral' | 'xAI' | 'DeepSeek' | 'Hugging Face'
//
// Rules:
//   - Only include feeds that cleanly map to ONE of the above labs.
//   - Do NOT add generic press outlets (TechCrunch, Wired, etc.) — they can't
//     be attributed to a single lab, so attribution would be wrong.
//   - Labs without a working first-party RSS endpoint (Anthropic, Meta,
//     Mistral, xAI, DeepSeek all 404/403 as of 2026-07) use Google News RSS
//     scoped to the lab's own news/blog path via a `site:` query, so every
//     item is still the lab's own post — attribution stays correct. Mark
//     those entries with `googleNews: true`: their titles carry a
//     " - Publisher" suffix (stripped in toCard) and their descriptions just
//     repeat the title, so no summary is derived from them. Links are
//     news.google.com redirects; they resolve, so we keep them.
//   - If a feed 404s or times out, it is skipped at runtime (see the per-feed
//     try/catch in collect()); the CI workflow fails loudly when fewer than
//     4 labs produce items.
// ---------------------------------------------------------------------------
const SOURCES = [
  // --- Hugging Face ---
  // Official Hugging Face blog (community + model releases).
  { feed: 'https://huggingface.co/blog/feed.xml', lab: 'Hugging Face' },

  // --- OpenAI ---
  { feed: 'https://openai.com/news/rss.xml', lab: 'OpenAI' },

  // --- Anthropic --- (first-party https://www.anthropic.com/news/rss is 404)
  {
    feed: 'https://news.google.com/rss/search?q=site:anthropic.com/news&hl=en-US&gl=US&ceid=US:en',
    lab: 'Anthropic',
    googleNews: true,
  },

  // --- Google DeepMind ---
  { feed: 'https://deepmind.google/blog/rss.xml', lab: 'Google DeepMind' },
  // Google AI / Research blog (also covers DeepMind releases).
  { feed: 'https://blog.google/technology/ai/rss/', lab: 'Google DeepMind' },

  // --- Meta --- (first-party https://ai.meta.com/blog/rss/ is 404)
  {
    feed: 'https://news.google.com/rss/search?q=site:ai.meta.com/blog&hl=en-US&gl=US&ceid=US:en',
    lab: 'Meta',
    googleNews: true,
  },

  // --- Mistral --- (first-party https://mistral.ai/news/feed.xml is 404)
  {
    feed: 'https://news.google.com/rss/search?q=site:mistral.ai/news&hl=en-US&gl=US&ceid=US:en',
    lab: 'Mistral',
    googleNews: true,
  },

  // --- xAI --- (first-party https://x.ai/news/rss.xml is 403)
  {
    feed: 'https://news.google.com/rss/search?q=site:x.ai/news&hl=en-US&gl=US&ceid=US:en',
    lab: 'xAI',
    googleNews: true,
  },

  // --- DeepSeek --- (first-party https://www.deepseek.com/news/rss.xml is
  // 404; DeepSeek publishes announcements on api-docs.deepseek.com)
  {
    feed: 'https://news.google.com/rss/search?q=site:api-docs.deepseek.com&hl=en-US&gl=US&ceid=US:en',
    lab: 'DeepSeek',
    googleNews: true,
  },
]

// ~240-char target for summaries.
const SUMMARY_MAX = 240
// Final cap on number of cards written (raised from 40).
const OUTPUT_CAP = 60
// Per-lab cap applied BEFORE the global cap, so high-volume publishers
// (OpenAI, Hugging Face) can't flood low-frequency labs out of the river.
const PER_LAB_CAP = 10
// Canonical site URL — used for the RSS 2.0 channel in public/feed.xml.
const SITE_URL = 'https://ai-pulse.vercel.app'
// Per-feed fetch timeout.
const FETCH_TIMEOUT_MS = 15000
// Per-feed response size cap. rss-parser buffers the whole body in memory, so
// without a cap a compromised feed endpoint could OOM the daily CI job.
const FETCH_MAX_BYTES = 5_000_000

// rss-parser instance (fed pre-fetched XML strings via parseString — see
// fetchFeedXml for the timeout/size-capped transport). customFields captures
// media/enclosure fields for thumbnail extraction.
const parser = new Parser({
  customFields: {
    item: [
      // RSS Media extensions (media:thumbnail, media:content).
      ['media:thumbnail', 'media:thumbnail'],
      ['media:content', { keepArray: true }],
      // Standard enclosure (e.g. podcast / image attachment).
      ['enclosure', 'enclosure'],
    ],
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase, strip non-url-safe chars, collapse to single hyphens. */
function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, '')     // trim leading/trailing hyphens
    .slice(0, 80)                // keep ids reasonably short
}

/** Strip HTML tags, decode a few common entities, and collapse whitespace. */
function cleanText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')    // remove tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim()
}

/** Truncate to max chars on a word boundary, adding an ellipsis if cut. */
function truncate(text, max) {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice
  return cut.trimEnd() + '…'
}

/** Best-effort ISO date from an rss-parser entry; falls back to "now". */
function toIsoDate(entry) {
  if (entry.isoDate) return entry.isoDate
  if (entry.pubDate) {
    const d = new Date(entry.pubDate)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

/**
 * Relevance filter: drop marketing / event / hiring posts that aren't a
 * release, feature, API change, or research result. Tested against the
 * combined title+summary text; a match means the card is discarded.
 */
const IRRELEVANT_RE = new RegExp(
  [
    // Events & appearances.
    '\\b(summit|conference|hackathon|webinar|meetup|keynote|fireside chat|expo|bootcamp)\\b',
    // Event-marketing calls to action.
    '\\b(register (now|today)|join us|rsvp|save the date|get tickets)\\b',
    // Hiring / careers posts.
    "\\b(we'?re hiring|job openings?|careers at)\\b",
    // Customer-story / case-study marketing.
    '\\b(customer stor(y|ies)|case stud(y|ies))\\b',
  ].join('|'),
  'i',
)

/** True when a card is release/feature/research content worth publishing. */
function isRelevant(card) {
  return !IRRELEVANT_RE.test(`${card.title} ${card.summary}`)
}

/**
 * Heuristic category classification from the combined title+summary text.
 * Order matters: research > api > model > feature (default).
 */
function classify(text) {
  const t = text.toLowerCase()
  if (/\b(paper|research|arxiv|interpretab|technical report)/.test(t)) return 'research'
  if (/\b(api|sdk|endpoint)/.test(t)) return 'api'
  // 'model' requires a real model signal — the old generic
  // /\b[a-z]+[- ]?\d+/ heuristic matched dates ("june 2026") and ordinary
  // numbers, mislabeling recap and event posts as model releases.
  if (
    // A known model-family name followed by a version number
    // (e.g. "gpt-5", "claude 4.1", "llama 4", "grok 4.5", "qwen 3").
    /\b(gpt|claude|gemini|gemma|llama|grok|mistral|mixtral|codestral|magistral|devstral|pixtral|deepseek|qwen|phi|opus|sonnet|haiku)[- ]?\d+(\.\d+)?\b/.test(t) ||
    // OpenAI o-series ("o3", "o4-mini").
    /\bo\d\b/.test(t) ||
    // A release verb applied to the word model/weights
    // ("announcing our new model", "released the weights").
    /\b(introduc|announc|releas|launch|unveil|ship)\w*\b[^.]{0,80}\b(models?|weights)\b/.test(t) ||
    /\b(open[- ]?weights?|foundation model|frontier model)\b/.test(t) ||
    // A release verb followed by a short versioned product name
    // ("Introducing Muse Spark 1.1"). \d{1,2} deliberately excludes
    // 4-digit years so "announced in June 2026" doesn't match.
    /\b(introduc|announc|unveil)\w*\s[^.]{0,50}\b\d{1,2}(\.\d+)?\b/.test(t) ||
    /\bv\d+(\.\d+)?\b/.test(t)
  ) {
    return 'model'
  }
  return 'feature'
}

// Common, low-signal words to keep out of inferred tags.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our',
  'are', 'was', 'were', 'has', 'have', 'had', 'will', 'can', 'new', 'now',
  'how', 'why', 'what', 'when', 'who', 'all', 'any', 'more', 'most', 'use',
  'using', 'used', 'about', 'over', 'out', 'its', 'their', 'they', 'them',
  'you', 'we', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'is', 'it',
  'as', 'be', 'or', 'we', 'introducing', 'announcing', 'available', 'today',
  // Newswire noise seen in live data ('latest', 'june', 'news', 'announced'):
  // release verbs, generic news words, and calendar words carry no signal on
  // a site where everything is a dated announcement.
  'news', 'latest', 'update', 'updates', 'updated',
  'announce', 'announces', 'announced', 'announcement', 'announcements',
  'introduce', 'introduces', 'introduced',
  'launch', 'launches', 'launched', 'launching',
  'release', 'releases', 'released', 'releasing',
  'unveil', 'unveils', 'unveiled', 'says', 'here',
  'week', 'month', 'year', 'day', 'days',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
])

/** Infer 2-4 short, lowercase, single-word keyword tags from the text. */
function inferTags(text) {
  const counts = new Map()
  const words = text.toLowerCase().match(/[a-z][a-z0-9+]{2,}/g) || []
  for (const w of words) {
    if (STOPWORDS.has(w)) continue
    counts.set(w, (counts.get(w) || 0) + 1)
  }
  // Highest-frequency words first; ties keep insertion order.
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
  return ranked.slice(0, 4)
}

/**
 * Extract a thumbnail URL from an rss-parser entry.
 *
 * Priority order:
 *   1. media:thumbnail[url]
 *   2. First media:content element whose type starts with "image/"
 *   3. enclosure.url when type starts "image/" or url ends with image extension
 *   4. First <img src="…"> found in content:encoded or content field
 *
 * Returns an absolute https?:// URL or undefined.
 */
function extractImage(entry) {
  // 1. media:thumbnail
  const thumb = entry['media:thumbnail']
  if (thumb) {
    const url = thumb?.$ ?.url || thumb?.url || (typeof thumb === 'string' ? thumb : undefined)
    if (url && /^https?:\/\//i.test(url)) return url
  }

  // 2. media:content (array, pick first image-type)
  const mediaContents = entry['media:content']
  if (Array.isArray(mediaContents)) {
    for (const mc of mediaContents) {
      const attrs = mc?.$ || mc
      const url = attrs?.url
      const type = attrs?.type || ''
      if (url && /^https?:\/\//i.test(url) && type.startsWith('image/')) {
        return url
      }
    }
    // Fallback: first media:content with any image-looking URL
    for (const mc of mediaContents) {
      const attrs = mc?.$ || mc
      const url = attrs?.url
      if (url && /^https?:\/\//i.test(url) && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)) {
        return url
      }
    }
  }

  // 3. enclosure
  const enc = entry.enclosure
  if (enc) {
    const url = enc.url
    const type = enc.type || ''
    if (url && /^https?:\/\//i.test(url)) {
      if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)) {
        return url
      }
    }
  }

  // 4. First <img src="…"> in content:encoded or content
  const rawHtml = entry['content:encoded'] || entry.content || ''
  if (rawHtml) {
    const m = rawHtml.match(/<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?/i)
    if (m && m[1]) return m[1]
  }

  return undefined
}

/**
 * Fetch a feed URL with a hard timeout and response-size cap, returning the
 * body as text for parser.parseString(). The size cap is enforced while
 * streaming, so an over-limit body is aborted early rather than buffered.
 */
async function fetchFeedXml(feedUrl) {
  // Outbound requests are restricted to the https:// allowlist in SOURCES.
  if (!/^https:\/\//i.test(feedUrl)) {
    throw new Error(`refusing non-https feed URL: ${feedUrl}`)
  }

  const res = await fetch(feedUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'User-Agent': 'ai-pulse-refresh/1.0 (+https://github.com/)',
      Accept:
        'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  // Fast reject when the server declares an over-limit size up front.
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > FETCH_MAX_BYTES) {
    throw new Error(`feed too large (${declared} bytes declared)`)
  }

  // Stream with a running byte count so we never buffer more than the cap.
  if (!res.body) {
    const buf = await res.arrayBuffer()
    if (buf.byteLength > FETCH_MAX_BYTES) throw new Error('feed too large')
    return new TextDecoder().decode(buf)
  }
  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > FETCH_MAX_BYTES) {
      await reader.cancel()
      throw new Error(`feed too large (>${FETCH_MAX_BYTES} bytes)`)
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Google News search-result titles end in " - Publisher". Strip that final
 * segment (only the last " - " chunk, so hyphenated product names survive).
 */
function stripGoogleNewsSuffix(title) {
  const idx = title.lastIndexOf(' - ')
  if (idx <= 0) return title
  const stripped = title.slice(0, idx).trim()
  return stripped || title
}

/**
 * Map a single rss-parser entry + its source lab to a Release card.
 * `googleNews: true` marks Google News proxy feeds: their titles carry a
 * " - Publisher" suffix (stripped here) and their descriptions merely repeat
 * the title as HTML, so no summary is derived from them (enrich.mjs can fill
 * summaries later).
 */
function toCard(entry, lab, googleNews = false) {
  let title = cleanText(entry.title)
  if (googleNews) title = stripGoogleNewsSuffix(title)
  if (!title) return null // skip entries without a usable title

  // Only absolute http(s) links may reach <a href> / clipboard in the UI —
  // never javascript:, data:, or other schemes from untrusted feed entries.
  const url = /^https?:\/\//i.test(entry.link || '') ? entry.link : undefined
  const date = toIsoDate(entry)

  // Summary: prefer contentSnippet (already text); if empty/whitespace, fall
  // back to stripping HTML from content:encoded or content; truncate to max.
  // Google News descriptions just repeat the title, so leave those empty.
  let summary = ''
  if (!googleNews) {
    let rawSummary = (entry.contentSnippet || '').trim()
    if (!rawSummary) {
      rawSummary = cleanText(entry['content:encoded'] || entry.content || entry.summary || '')
    }
    summary = truncate(rawSummary || cleanText(entry.summary || ''), SUMMARY_MAX)
  }

  // id: slug of guid or link; fallback to slug(title + date).
  const idSource = entry.guid || entry.link || `${title} ${date}`
  const id = slugify(idSource) || slugify(`${title}-${date}`)

  const haystack = `${title} ${summary}`
  const category = classify(haystack)
  const tags = inferTags(haystack)

  // Thumbnail extraction — only include absolute http(s) URLs.
  const image = extractImage(entry)

  return {
    id,
    lab,
    title,
    summary,
    date,
    category,
    ...(url   ? { url }   : {}),
    ...(image ? { image } : {}),
    ...(tags.length ? { tags } : {}),
  }
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

/**
 * Fetch and map every source. RESILIENT: a failing/4xx feed is logged with a
 * console.warn and skipped, so the script still succeeds on partial results.
 * Returns { cards, perFeed } where perFeed is a [label, count] list for logging.
 */
async function collect() {
  const cards = []
  const perFeed = []

  for (const source of SOURCES) {
    try {
      const xml = await fetchFeedXml(source.feed)
      const feed = await parser.parseString(xml)
      const items = feed.items || []
      let mapped = 0
      for (const item of items) {
        const card = toCard(item, source.lab, source.googleNews === true)
        if (card && isRelevant(card)) {
          cards.push(card)
          mapped++
        }
      }
      perFeed.push([source.feed, mapped])
    } catch (err) {
      // One bad feed must not break the run.
      console.warn(`⚠️  Skipped feed ${source.feed} — ${err?.message || err}`)
      perFeed.push([source.feed, 0])
    }
  }

  return { cards, perFeed }
}

/**
 * Dedupe by id AND by url, sort by date descending, cap each lab to
 * PER_LAB_CAP (so OpenAI/Hugging Face volume can't crowd out low-frequency
 * labs), then cap globally to OUTPUT_CAP.
 */
function finalize(cards) {
  const seenIds  = new Set()
  const seenUrls = new Set()
  const unique   = []

  for (const card of cards) {
    if (seenIds.has(card.id)) continue
    if (card.url && seenUrls.has(card.url)) continue
    seenIds.add(card.id)
    if (card.url) seenUrls.add(card.url)
    unique.push(card)
  }

  unique.sort((a, b) => new Date(b.date) - new Date(a.date)) // newest first

  // Per-lab cap: cards are newest-first, so keeping the first PER_LAB_CAP per
  // lab keeps each lab's newest items.
  const perLabCounts = new Map()
  const capped = []
  for (const card of unique) {
    const n = perLabCounts.get(card.lab) || 0
    if (n >= PER_LAB_CAP) continue
    perLabCounts.set(card.lab, n + 1)
    capped.push(card)
  }

  return capped.slice(0, OUTPUT_CAP)
}

// ---------------------------------------------------------------------------
// Optional enrichment hook
// ---------------------------------------------------------------------------

/**
 * Try to dynamically import ./enrich.mjs (sibling of this file) and, if it
 * exports an async `enrich(releases)`, run it. A missing or broken enrich.mjs
 * is non-fatal — we just return the input unchanged.
 */
async function runEnrichment(releases) {
  try {
    const mod = await import('./enrich.mjs')
    if (typeof mod.enrich === 'function') {
      const enriched = await mod.enrich(releases)
      if (Array.isArray(enriched)) {
        console.log('✨ Enrichment hook applied (enrich.mjs).')
        return enriched
      }
      console.warn('⚠️  enrich() did not return an array; ignoring its output.')
    }
  } catch (err) {
    // Most commonly ERR_MODULE_NOT_FOUND when enrich.mjs is absent — that's fine.
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
      console.warn(`⚠️  Enrichment hook error (ignored) — ${err?.message || err}`)
    }
  }
  return releases
}

// ---------------------------------------------------------------------------
// RSS 2.0 output (public/feed.xml)
// ---------------------------------------------------------------------------

/** Escape the five XML special characters for element/attribute content. */
function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** RFC 822-style date required by RSS 2.0 <pubDate>/<lastBuildDate>. */
function toRfc822(isoDate) {
  const d = new Date(isoDate)
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString()
}

/** Build an RSS 2.0 document from the finalized release cards. */
function buildRssFeed(releases, generatedAt) {
  const items = releases
    .map((r) => {
      const lines = [
        '    <item>',
        `      <title>${escapeXml(r.title)}</title>`,
      ]
      if (r.url) lines.push(`      <link>${escapeXml(r.url)}</link>`)
      lines.push(`      <guid isPermaLink="false">${escapeXml(r.id)}</guid>`)
      lines.push(`      <pubDate>${toRfc822(r.date)}</pubDate>`)
      const description = r.summary
        ? `${r.summary} (Source: ${r.lab})`
        : `Source: ${r.lab}`
      lines.push(`      <description>${escapeXml(description)}</description>`)
      lines.push(`      <source url="${escapeXml(SITE_URL)}">${escapeXml(r.lab)}</source>`)
      lines.push(`      <category>${escapeXml(r.category)}</category>`)
      lines.push('    </item>')
      return lines.join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>AI Pulse</title>',
    `    <link>${escapeXml(SITE_URL)}</link>`,
    '    <description>Model, feature, API, and research drops from the top AI labs.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${toRfc822(generatedAt)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml"/>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Refreshing AI news from ${SOURCES.length} sources…`)

  const { cards, perFeed } = await collect()
  let releases = finalize(cards)
  releases = await runEnrichment(releases)

  const generatedAt = new Date().toISOString()

  // Per-lab counts over the FINAL output — this is what meta.json reports and
  // what the CI coverage gate checks.
  const labs = {}
  for (const r of releases) {
    labs[r.lab] = (labs[r.lab] || 0) + 1
  }

  // Resolve output paths relative to THIS file so it works from any cwd:
  // scripts/refresh-news.mjs -> ../public/…
  const releasesPath = fileURLToPath(new URL('../public/releases.json', import.meta.url))
  const metaPath     = fileURLToPath(new URL('../public/meta.json', import.meta.url))
  const feedPath     = fileURLToPath(new URL('../public/feed.xml', import.meta.url))

  // releases.json keeps its original shape: a top-level JSON array (the
  // frontend's sanitizeReleases() expects exactly that). Freshness metadata
  // goes in the sibling meta.json instead.
  await writeFile(releasesPath, JSON.stringify(releases, null, 2) + '\n', 'utf8')
  await writeFile(metaPath, JSON.stringify({ generatedAt, labs }, null, 2) + '\n', 'utf8')
  await writeFile(feedPath, buildRssFeed(releases, generatedAt), 'utf8')

  // Concise summary: per-feed counts, per-lab counts, then the final total.
  console.log('\nPer-feed counts:')
  for (const [feedUrl, count] of perFeed) {
    console.log(`  ${String(count).padStart(3)}  ${feedUrl}`)
  }
  console.log('\nPer-lab counts (final output):')
  for (const [lab, count] of Object.entries(labs)) {
    console.log(`  ${String(count).padStart(3)}  ${lab}`)
  }
  console.log(`\n✅ Wrote ${releases.length} releases to ${releasesPath}`)
  console.log(`✅ Wrote ${metaPath}`)
  console.log(`✅ Wrote ${feedPath}`)
}

main().catch((err) => {
  console.error('Fatal error in refresh-news:', err)
  process.exitCode = 1
})
