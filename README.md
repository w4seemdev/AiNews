# AI Pulse

**A self-updating AI-news site: every model, feature, and research drop from 8 major AI labs, collected automatically every day: no CMS, no server, no manual editing.**

![AI Pulse, the front page of AI releases](public/og-image.png)

![React](https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
[![CI](https://github.com/w4seemdev/AiNews/actions/workflows/ci.yml/badge.svg)](https://github.com/w4seemdev/AiNews/actions/workflows/ci.yml)
[![Refresh AI news](https://github.com/w4seemdev/AiNews/actions/workflows/refresh-news.yml/badge.svg)](https://github.com/w4seemdev/AiNews/actions/workflows/refresh-news.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

Keeping up with AI news means checking eight different lab blogs every morning. AI Pulse solves that with a fully automated pipeline: a scheduled GitHub Action fetches the labs' RSS feeds daily, filters and normalizes the entries into clean release cards, and commits the result straight into the repo, so the site updates itself with **zero servers, zero database, and zero hosting cost**. The frontend is a fast, dark-blue newswire built in React 18 + TypeScript that reads the generated JSON at runtime.

## Key Features

- **Automated daily news pipeline**: a GitHub Actions cron job (06:00 UTC, confirmed running) collects releases from **8 AI labs**: OpenAI, Anthropic, Google DeepMind, Meta, Mistral, xAI, DeepSeek, and Hugging Face
- **Smart source fallbacks**: labs without a working first-party RSS feed are covered through scoped Google News queries (`site:` restricted to the lab's own blog), so attribution always stays with the original publisher
- **Relevance filtering & fair ranking**: noise filtering, per-lab caps so high-volume publishers can't drown out quieter labs, and a global output cap keep the feed sharp
- **Optional AI enrichment**: a Claude-powered stage (via `@anthropic-ai/sdk`) cleans summaries, fixes categories, and extracts model metrics; it degrades gracefully to a no-op when no API key is configured
- **Three output formats**: the pipeline publishes `releases.json` (site data), `feed.xml` (a standards-compliant RSS 2.0 feed readers can subscribe to), and `meta.json` (per-lab item counts and freshness metadata)
- **Reader-friendly newswire UI**: lead story, date-bucketed river, category filters, full-text search, density toggle, save/read tracking, and a sidebar with per-source counts
- **SEO prerendering**: a build script injects the 10 newest headlines as semantic HTML plus schema.org ItemList JSON-LD directly into `index.html`, so crawlers see real content instead of an empty React root

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v3 + custom design tokens, lucide-react icons |
| Data pipeline | Node.js (ESM), rss-parser |
| AI enrichment (optional) | Anthropic SDK (Claude Haiku) |
| Automation | GitHub Actions (daily cron + CI quality gate) |
| Hosting model | Fully static: any static host or CDN |

## Quick Start

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other commands:

```bash
npm run build      # production build to /dist
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit (vite build alone does not check types)
npm run refresh    # run the news pipeline → regenerates public/releases.json, meta.json, feed.xml
npm run prerender  # inject the top-10 headlines into index.html for crawlers
```

**Environment variables**: none required. Optionally set `ANTHROPIC_API_KEY` (locally, or as a GitHub Actions repo secret) to enable the LLM enrichment stage; without it the pipeline runs end-to-end and simply skips that step.

**Deployment note**: the canonical site URL is hardcoded in `index.html`, `public/robots.txt`, `public/sitemap.xml`, and `scripts/refresh-news.mjs` (`SITE_URL`); update all four when pointing the site at your domain.

Full pipeline documentation (stages, source configuration, enrichment setup): [`scripts/README.md`](scripts/README.md).

## Architecture

```
GitHub Actions (daily cron, 06:00 UTC)
  └─ ① Collector  scripts/refresh-news.mjs   → fetch 8 labs' RSS, filter, normalize to cards
  └─ ② Enricher   scripts/enrich.mjs         → optional Claude pass (summaries, categories, metrics)
  └─ ③ Publisher                             → public/releases.json + meta.json + feed.xml
  └─ ④ Coverage gate                         → job fails loudly if < 4 labs produced items
  └─ ⑤ Commit-if-changed                     → bot commit triggers static redeploy

React app (static)
  └─ fetches /releases.json at runtime → validates → renders the newswire
```

## Engineering Highlights

- **Supply-chain-hardened CI/CD**: every GitHub Action is pinned to an immutable commit SHA (tag-hijack protection), workflows default to `permissions: {}` with `contents:write` scoped to the single job that needs it, and `npm ci --ignore-scripts` blocks dependency install scripts in jobs holding secrets
- **Defensive data ingestion**: per-feed timeouts (15 s) and a 5 MB response-size cap so one slow or compromised feed endpoint can't hang or OOM the pipeline; individual feed failures are isolated so a single broken source never kills the run
- **Loud failure over silent decay**: a dedicated CI gate parses `meta.json` after each run and fails the workflow if fewer than 4 labs produced items, turning gradual source rot into an immediate red build
- **Runtime input validation**: the frontend sanitizes the fetched feed through a dedicated validator (`src/lib/validate.ts`) and falls back to bundled sample data if the fetch fails, so the UI never renders from malformed input
- **CI quality gate on every push/PR**: pinned-dependency install, full TypeScript typecheck, and a production build must all pass before anything lands

## What This Project Demonstrates

- Designing and shipping an **end-to-end automated data pipeline** (ingest → transform → publish) with real scheduling and failure handling
- **CI/CD engineering** on GitHub Actions, including security hardening practices most production teams require
- **React + TypeScript architecture** with clean component decomposition, typed data models, and a strict compile gate
- **API/feed integration** across heterogeneous sources with normalization, fallbacks, and attribution handling
- **LLM integration done responsibly**: optional, cost-aware, and gracefully degradable
- **Technical SEO**: prerendered content for crawlers, structured data (JSON-LD), sitemap, robots.txt, and an RSS feed

## License

MIT, see [`LICENSE`](LICENSE).

---

Built by **Waseem Abu Fares**, [github.com/w4seemdev](https://github.com/w4seemdev)
