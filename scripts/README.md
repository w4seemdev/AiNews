# News pipeline

This folder holds the daily pipeline that keeps the AI Pulse feed fresh. The
site itself is static — at runtime the browser just fetches `public/releases.json`.
A scheduled GitHub Action regenerates that file once a day, so the news updates
with **no code change and no redeploy**.

## Stages

The pipeline runs in three stages, with a scheduler driving the whole thing:

- **① Collector — `scripts/refresh-news.mjs`**
  Fetches the configured RSS feeds and maps each entry to a release **card**
  (the `Release` shape in `src/types.ts`):
  `{ id, lab, title, summary, date, category, url?, contextWindow?, priceInput?, priceOutput?, benchmark?, tags? }`.

- **② Summarizer / enrichment — `scripts/enrich.mjs` (optional LLM)**
  Takes the collected cards and returns the same shape with cleaner summaries,
  corrected categories, tighter tags, and extracted model metrics. This stage
  is **fully optional**: with no `ANTHROPIC_API_KEY` (or the SDK not installed)
  it logs a single line and returns the cards untouched. See
  [Enabling the LLM step](#enabling-the-llm-step).

- **③ Publisher — writes `public/releases.json`**
  The collector serializes the (optionally enriched) cards to
  `public/releases.json`, which the deployed site fetches at runtime.

- **⏰ Scheduler — `.github/workflows/refresh-news.yml`**
  A GitHub Action cron that runs the pipeline **daily at 06:00 UTC** (and can be
  triggered manually from the Actions tab).

## Run it locally

```bash
npm run refresh
```

This runs `node scripts/refresh-news.mjs` — collector → (optional) enrichment →
publisher — and writes `public/releases.json`. Set `ANTHROPIC_API_KEY` in your
environment first if you want the LLM enrichment step to run locally.

## Add or change sources

Edit the `SOURCES` list in `scripts/refresh-news.mjs`. Each source is an RSS
feed mapped to a lab; add, remove, or re-map entries there, then run
`npm run refresh` to regenerate the feed.

## Enabling the LLM step

Enrichment is off by default and requires two things:

1. **Add the repo secret** `ANTHROPIC_API_KEY`
   (GitHub → Settings → Secrets and variables → Actions). The workflow already
   passes it through to `npm run refresh`.
2. **Install the SDK** so `scripts/enrich.mjs` can import it:

   ```bash
   npm i @anthropic-ai/sdk
   ```

With both in place, `enrich.mjs` normalizes each card with Claude Haiku
(cheap/fast, small batches). Without either, the pipeline runs unchanged and
the raw collected cards are published.

## How the refresh works

The GitHub Action runs once a day, regenerates `public/releases.json` from the
latest RSS entries (optionally polishing them through the LLM step), and — only
if that file actually changed — commits it back with the message
`chore: refresh AI news feed` under a neutral `github-actions[bot]` identity.
The deployed site loads `public/releases.json` at runtime, so the news feed
updates automatically with no code change or manual deploy.
