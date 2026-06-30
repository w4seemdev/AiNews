export type Category = 'model' | 'feature' | 'api' | 'research'

export type Lab =
  | 'OpenAI'
  | 'Anthropic'
  | 'Google DeepMind'
  | 'Meta'
  | 'Mistral'
  | 'xAI'
  | 'DeepSeek'
  | 'Hugging Face'

export interface Release {
  id: string
  /** The lab / company that shipped it */
  lab: Lab
  /** Headline, e.g. "Claude Opus 4.8" */
  title: string
  /** One- or two-sentence plain-English summary */
  summary: string
  /** ISO 8601 timestamp of the announcement */
  date: string
  category: Category
  /** Link to the official announcement */
  url?: string
  // --- Optional model metrics (shown on model cards) ---
  contextWindow?: string
  priceInput?: string
  priceOutput?: string
  benchmark?: string
  /** Free-form tags, e.g. ["frontier", "coding"] */
  tags?: string[]
  /** Thumbnail / preview image URL (absolute https). Omit if not available. */
  image?: string
}
