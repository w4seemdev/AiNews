// scripts/enrich.mjs
//
// OPTIONAL LLM enrichment stage of the daily news pipeline.
//
// Contract:
//   import { enrich } from './enrich.mjs'
//   const cleaned = await enrich(releases)   // same shape in, same shape out
//
// A "release" is a card object (see src/types.ts):
//   {
//     id, lab, title, summary, date (ISO),
//     category: 'model' | 'feature' | 'api' | 'research',
//     url?, contextWindow?, priceInput?, priceOutput?, benchmark?, tags?: string[]
//   }
//   lab ∈ OpenAI | Anthropic | Google DeepMind | Meta | Mistral | xAI | DeepSeek
//
// DESIGN GOALS
// ------------
//  1. FULLY OPTIONAL. The default path — no ANTHROPIC_API_KEY, package not
//     installed — must work with ZERO extra setup. In that case we simply
//     return the input untouched and log one info line.
//  2. NEVER THROWS. Enrichment is a "nice to have" that runs inside a daily
//     cron. A bad API key, a network blip, a malformed model response, or a
//     single weird release must never crash the whole refresh. Every failure
//     path falls back to the original data.
//  3. CHEAP & BOUNDED. We use Claude Haiku (small/fast) with a low max_tokens
//     and process releases in small batches to keep total API calls reasonable.
//
// When enabled, for each release we ask Claude to normalize it back into the
// exact card shape: tidy the summary, correct an obviously-wrong category,
// improve tags, and extract model metrics (contextWindow / priceInput /
// priceOutput / benchmark) when the source text mentions them. Anything the
// model is unsure about, it leaves as-is.

// ---------------------------------------------------------------------------
// Configuration constants. Kept here so the behaviour is easy to tune.
// ---------------------------------------------------------------------------

// Cheap/fast model. Pinned to a dated snapshot for reproducible cron runs.
const MODEL = 'claude-haiku-4-5-20251001'

// Low cap: each call enriches a small batch and returns compact JSON, so a
// few hundred tokens of output is plenty. Bounds cost and latency.
const MAX_TOKENS = 1024

// How many releases to send to the model per request. Small batches keep each
// prompt short (better adherence) and cap the blast radius if one batch fails.
const BATCH_SIZE = 5

// The only valid categories / labs, mirrored from src/types.ts. We pass these
// to the model and also use them to validate whatever comes back.
const CATEGORIES = ['model', 'feature', 'api', 'research']
const LABS = [
  'OpenAI',
  'Anthropic',
  'Google DeepMind',
  'Meta',
  'Mistral',
  'xAI',
  'DeepSeek',
  'Hugging Face',
]

/**
 * Enrich an array of release cards. Always resolves to an array of the same
 * length and shape. Never rejects.
 *
 * @param {Array<object>} releases
 * @returns {Promise<Array<object>>}
 */
export async function enrich(releases) {
  // Defensive: only operate on a real array. Anything else passes through.
  if (!Array.isArray(releases) || releases.length === 0) {
    return Array.isArray(releases) ? releases : []
  }

  // ----- Gate 1: API key present? --------------------------------------
  // No key => enrichment is intentionally disabled. This is the default,
  // zero-config path; it must succeed silently (one info line) and return the
  // input unchanged.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.info(
      '[enrich] ANTHROPIC_API_KEY not set — skipping LLM enrichment (using raw releases).',
    )
    return releases
  }

  // ----- Gate 2: SDK importable? ---------------------------------------
  // The '@anthropic-ai/sdk' package is an OPTIONAL dependency. If it isn't
  // installed, the dynamic import throws — we catch it and fall back.
  let Anthropic
  try {
    ;({ default: Anthropic } = await import('@anthropic-ai/sdk'))
  } catch {
    console.info(
      "[enrich] '@anthropic-ai/sdk' not installed — skipping LLM enrichment " +
        '(run `npm i @anthropic-ai/sdk` to enable).',
    )
    return releases
  }

  // ----- Enrichment enabled --------------------------------------------
  let client
  try {
    client = new Anthropic() // reads ANTHROPIC_API_KEY from the environment
  } catch (err) {
    // Even client construction is wrapped — bad env, etc.
    console.warn(
      `[enrich] could not initialise Anthropic client (${err?.message}). Using raw releases.`,
    )
    return releases
  }

  console.info(
    `[enrich] enriching ${releases.length} release(s) with ${MODEL} in batches of ${BATCH_SIZE}…`,
  )

  // Work on a copy so the caller's array is never mutated.
  const out = releases.slice()

  // Process in small batches. Each batch is independent: a failure in one
  // batch leaves those items as their originals and the loop continues.
  for (let start = 0; start < out.length; start += BATCH_SIZE) {
    const batch = out.slice(start, start + BATCH_SIZE)
    try {
      const enrichedBatch = await enrichBatch(client, batch)
      // Splice the enriched items back into their original positions.
      for (let i = 0; i < enrichedBatch.length; i++) {
        out[start + i] = enrichedBatch[i]
      }
    } catch (err) {
      // Defensive: never let a batch error escape. Keep the originals.
      console.warn(
        `[enrich] batch starting at index ${start} failed (${err?.message}). Keeping originals.`,
      )
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ask Claude to normalize one batch of releases. Returns an array the same
 * length as `batch`; any item the model couldn't safely improve is returned
 * as its original.
 */
async function enrichBatch(client, batch) {
  // We give the model the originals keyed by `id` and ask it to return a JSON
  // object keyed by the same ids, so we can match results back deterministically
  // even if the model reorders or drops items.
  const input = batch.map((r) => ({
    id: r.id,
    lab: r.lab,
    title: r.title,
    summary: r.summary,
    date: r.date,
    category: r.category,
    url: r.url ?? null,
    contextWindow: r.contextWindow ?? null,
    priceInput: r.priceInput ?? null,
    priceOutput: r.priceOutput ?? null,
    benchmark: r.benchmark ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
  }))

  const system =
    'You normalize AI-product release cards for a news feed. ' +
    'For each card you may: tidy the summary to one or two clear sentences; ' +
    'correct the category only if it is clearly wrong; tighten tags ' +
    '(lowercase, 1-4 concise tags); and extract model metrics ' +
    '(contextWindow, priceInput, priceOutput, benchmark) ONLY when the ' +
    'existing text clearly implies them. Never invent facts, prices, ' +
    'benchmarks, or URLs. If unsure about a field, keep the original value. ' +
    `Valid categories: ${CATEGORIES.join(', ')}. ` +
    `Valid labs: ${LABS.join(', ')}. Never change id, lab, title, date, or url.`

  // Structured output: constrain the response to a JSON object mapping each
  // id -> normalized card. (No assistant prefill — prefills 400 on this model.)
  const schema = {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            summary: { type: 'string' },
            category: { type: 'string', enum: CATEGORIES },
            contextWindow: { type: ['string', 'null'] },
            priceInput: { type: ['string', 'null'] },
            priceOutput: { type: ['string', 'null'] },
            benchmark: { type: ['string', 'null'] },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['id'],
          additionalProperties: false,
        },
      },
    },
    required: ['cards'],
    additionalProperties: false,
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [
      {
        role: 'user',
        content:
          'Normalize these release cards. Return one entry per card, keyed by ' +
          'its id, keeping any value you are unsure about unchanged.\n\n' +
          JSON.stringify(input),
      },
    ],
  })

  // Safety: a refusal or non-text response means we keep the originals.
  if (response.stop_reason === 'refusal') {
    console.warn('[enrich] model refused this batch. Keeping originals.')
    return batch
  }

  const parsed = parseCards(response)
  if (!parsed) {
    console.warn('[enrich] could not parse model output. Keeping originals.')
    return batch
  }

  // Index the model output by id for deterministic matching.
  const byId = new Map()
  for (const card of parsed) {
    if (card && typeof card.id === 'string') byId.set(card.id, card)
  }

  // Merge per item. Each merge is independent and defensive: on ANY problem
  // for a given release, we keep that original release intact.
  return batch.map((original) => {
    try {
      const update = byId.get(original.id)
      if (!update) return original
      return mergeRelease(original, update)
    } catch {
      return original
    }
  })
}

/**
 * Pull the JSON `cards` array out of a Messages API response, tolerating both
 * the parsed-output helper and raw text blocks.
 */
function parseCards(response) {
  try {
    // Some SDK versions expose a convenience parsed field.
    if (response.parsed_output && Array.isArray(response.parsed_output.cards)) {
      return response.parsed_output.cards
    }
    // Otherwise concatenate text blocks and JSON.parse them.
    const text = (response.content || [])
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('')
      .trim()
    if (!text) return null
    const obj = JSON.parse(text)
    return Array.isArray(obj?.cards) ? obj.cards : null
  } catch {
    return null
  }
}

/**
 * Merge a model-suggested update onto an original release, accepting only
 * safe, well-typed fields. Identity fields (id, lab, title, date, url) are
 * NEVER overwritten. Returns a new object; never throws on bad input.
 */
function mergeRelease(original, update) {
  const merged = { ...original }

  // summary: accept a non-empty trimmed string.
  if (typeof update.summary === 'string' && update.summary.trim()) {
    merged.summary = update.summary.trim()
  }

  // category: accept only if it is one of the valid enum values.
  if (
    typeof update.category === 'string' &&
    CATEGORIES.includes(update.category)
  ) {
    merged.category = update.category
  }

  // Optional string metrics: accept non-empty strings; ignore null/empty so we
  // never erase an existing value with a blank.
  for (const key of ['contextWindow', 'priceInput', 'priceOutput', 'benchmark']) {
    const v = update[key]
    if (typeof v === 'string' && v.trim()) merged[key] = v.trim()
  }

  // tags: accept a clean array of non-empty strings; cap to keep cards tidy.
  if (Array.isArray(update.tags)) {
    const tags = update.tags
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim())
      .slice(0, 6)
    if (tags.length) merged.tags = tags
  }

  return merged
}
