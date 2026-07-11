# AI Pulse

**The front page of AI releases.** A daily-refreshed feed of model, feature, API, and research drops from the top AI labs — presented as a clean, dark-blue newswire, newest at the top.

The site is fully static: the browser fetches `public/releases.json` at runtime, and a scheduled GitHub Action regenerates that file once a day from the labs' RSS feeds. See [`scripts/README.md`](scripts/README.md) for the full pipeline (collector → optional LLM enrichment → publisher).

Production domain: `https://ai-pulse.vercel.app/` (hardcoded in `index.html`, `public/robots.txt`, and `public/sitemap.xml` — update all three if the domain changes).

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS v3** (design tokens in `src/styles/tokens.css`)
- **lucide-react** icons
- Pipeline: **rss-parser**, optional **@anthropic-ai/sdk** enrichment (Haiku)

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

```bash
npm run build      # production build to /dist
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit (vite build alone does not check types)
npm run refresh    # run the news pipeline → regenerates public/releases.json
npm run prerender  # inject the top-10 headlines into index.html for crawlers
```

## Project structure

```
src/
  components/
    Masthead.tsx          # sticky top bar: brand, date, refresh badge
    Feed.tsx              # loads /releases.json, filters, date-bucketed river
    LeadStory.tsx         # large lead-story card at the top of the river
    NewsRow.tsx           # one release row (save/read actions, tags, meta)
    Sidebar.tsx           # source counts + latest-items panel
    FilterBar.tsx         # category filter chips
    SearchToolbar.tsx     # search input + density toggle
    NewsletterSignup.tsx  # email signup block
    Footer.tsx            # footer links
  data/releases.ts        # fallback sample data (used only if the fetch fails)
  lib/                    # validate.ts (feed sanitizer), storage.ts, format.ts
  types.ts                # Release / Lab / Category types
scripts/
  refresh-news.mjs        # daily collector → public/releases.json
  enrich.mjs              # optional LLM enrichment stage
  prerender.mjs           # static top-stories block for crawlers → index.html
public/
  releases.json           # the live feed (committed daily by the Action)
```

## Data pipeline

`.github/workflows/refresh-news.yml` runs daily at 06:00 UTC: it fetches the configured RSS sources, maps entries to release cards, optionally enriches them with Claude Haiku (requires the `ANTHROPIC_API_KEY` repo secret), and commits `public/releases.json` if it changed. On Vercel, that bot commit triggers the auto-deploy that actually publishes the new data. Details, source configuration, and local usage: [`scripts/README.md`](scripts/README.md).

## SEO / distribution

- `scripts/prerender.mjs` injects the 10 newest headlines (semantic `<article>` list + schema.org ItemList JSON-LD) between the `prerender` markers in `index.html`, so crawlers see real content instead of an empty `#root`. Run it after every refresh.
- Open Graph / Twitter card with a static `public/og-image.png` (1200x630).
- `robots.txt`, `sitemap.xml`, a JSON feed (`/releases.json`), and an RSS feed (`/feed.xml`, emitted by the refresh pipeline).

## Roadmap

- Full Arabic (RTL) localization with an EN/AR toggle
- Per-release detail pages + programmatic SEO
- Real newsletter provider behind the signup form

## License

MIT — see [`LICENSE`](LICENSE).
