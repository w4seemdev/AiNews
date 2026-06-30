# AI Pulse

**The front page of AI releases.** A real-time feed of every model, feature, API, and research drop from the top AI labs (OpenAI, Anthropic, Google DeepMind, Meta, Mistral, xAI, DeepSeek) — presented as a clean, dark-blue card feed, newest at the top.

> Built with React + Tailwind. Designed in the spirit of a polished SaaS site (split.io-style layout) recolored to a dark-blue palette.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS v3**
- **lucide-react** icons

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

```bash
npm run build    # production build to /dist
npm run preview  # preview the production build
```

## Project structure

```
src/
  components/
    Navbar.tsx        # sticky top nav + AR/EN toggle + subscribe
    FeedHeader.tsx    # compact hero: title, tagline, inline subscribe
    FilterBar.tsx     # category filter chips (All / Models / Features / API / Research)
    Feed.tsx          # sorts releases newest-first, renders the card stack + load more
    NewsCard.tsx      # the core news/release card
    Footer.tsx        # footer with links + socials
  data/
    releases.ts       # SAMPLE seed data (replace with a real source)
  types.ts            # Release / Lab / Category types
```

## Roadmap ideas

- Real data ingestion (RSS / official changelogs / arXiv / APIs) + daily automation
- Full Arabic (RTL) localization with an EN/AR toggle
- Per-release detail pages + programmatic SEO
- Email digest (newsletter) integration
- Public JSON/API feed of releases

## License

MIT — see `LICENSE`.
