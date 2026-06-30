// scripts/refresh-news.mjs
//
// Collector + Publisher stage of the daily AI-news refresh pipeline.
//
// Fetches RSS feeds from AI labs / community sources, maps each entry to the
// card shape consumed by the website (see src/types.ts -> Release), dedupes,
// sorts newest-first, caps to 60, optionally runs an enrichment hook, and
// writes public/releases.json.
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
//   - If a feed 404s or times out, it is skipped silently at runtime (see the
//     per-feed try/catch in collect()); just swap in a working URL.
// ---------------------------------------------------------------------------
const SOURCES = [
  // --- Hugging Face ---
  // Official Hugging Face blog (community + model releases).
  { feed: 'https://huggingface.co/blog/feed.xml', lab: 'Hugging Face' },

  // --- OpenAI ---
  { feed: 'https://openai.com/news/rss.xml', lab: 'OpenAI' },

  // --- Anthropic ---
  { feed: 'https://www.anthropic.com/news/rss', lab: 'Anthropic' },

  // --- Google DeepMind ---
  { feed: 'https://deepmind.google/blog/rss.xml', lab: 'Google DeepMind' },
  // Google AI / Research blog (also covers DeepMind releases).
  { feed: 'https://blog.google/technology/ai/rss/', lab: 'Google DeepMind' },

  // --- Meta ---
  { feed: 'https://ai.meta.com/blog/rss/', lab: 'Meta' },

  // --- Mistral ---
  { feed: 'https://mistral.ai/news/feed.xml', lab: 'Mistral' },

  // --- xAI ---
  { feed: 'https://x.ai/news/rss.xml', lab: 'xAI' },

  // --- DeepSeek ---
  { feed: 'https://www.deepseek.com/news/rss.xml', lab: 'DeepSeek' },
]

// ~240-char target for summaries.
const SUMMARY_MAX = 240
// Final cap on number of cards written (raised from 40).
const OUTPUT_CAP = 60

// rss-parser instance. customFields captures media/enclosure fields for
// thumbnail extraction. A short timeout + browser-like UA helps feeds that
// reject the default agent.
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'ai-pulse-refresh/1.0 (+https://github.com/)' },
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
 * Heuristic category classification from the combined title+summary text.
 * Order matters: research > api > model > feature (default).
 */
function classify(text) {
  const t = text.toLowerCase()
  if (/\b(paper|research|arxiv|interpretab)/.test(t)) return 'research'
  if (/\b(api|sdk|endpoint)/.test(t)) return 'api'
  // "introducing/announcing/available" or a version/model-name pattern
  // (e.g. "gpt-4", "claude 3.5", "llama 3", "v2", "1.5").
  if (
    /\b(introduc|announc|available)/.test(t) ||
    /\b[a-z]+[- ]?\d+(\.\d+)?\b/.test(t) ||
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

/** Map a single rss-parser entry + its source lab to a Release card. */
function toCard(entry, lab) {
  const title = cleanText(entry.title)
  if (!title) return null // skip entries without a usable title

  const url = entry.link || undefined
  const date = toIsoDate(entry)

  // Summary: prefer contentSnippet (already text); if empty/whitespace, fall
  // back to stripping HTML from content:encoded or content; truncate to max.
  let rawSummary = (entry.contentSnippet || '').trim()
  if (!rawSummary) {
    rawSummary = cleanText(entry['content:encoded'] || entry.content || entry.summary || '')
  }
  const summary = truncate(rawSummary || cleanText(entry.summary || ''), SUMMARY_MAX)

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
      const feed = await parser.parseURL(source.feed)
      const items = feed.items || []
      let mapped = 0
      for (const item of items) {
        const card = toCard(item, source.lab)
        if (card) {
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

/** Dedupe by id AND by url, sort by date descending, cap to OUTPUT_CAP. */
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
  return unique.slice(0, OUTPUT_CAP)
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Refreshing AI news from ${SOURCES.length} sources…`)

  const { cards, perFeed } = await collect()
  let releases = finalize(cards)
  releases = await runEnrichment(releases)

  // Resolve output path relative to THIS file so it works from any cwd:
  // scripts/refresh-news.mjs -> ../public/releases.json
  const outPath = fileURLToPath(new URL('../public/releases.json', import.meta.url))
  await writeFile(outPath, JSON.stringify(releases, null, 2) + '\n', 'utf8')

  // Concise summary: per-feed counts then the final total.
  console.log('\nPer-feed counts:')
  for (const [feedUrl, count] of perFeed) {
    console.log(`  ${String(count).padStart(3)}  ${feedUrl}`)
  }
  console.log(`\n✅ Wrote ${releases.length} releases to ${outPath}`)
}

main().catch((err) => {
  console.error('Fatal error in refresh-news:', err)
  process.exitCode = 1
})
