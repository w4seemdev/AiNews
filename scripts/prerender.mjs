#!/usr/bin/env node
/**
 * prerender.mjs — inject a static top-stories block into index.html.
 *
 * The site renders client-side from /releases.json, so a bare index.html shows
 * crawlers an empty shell. This script reads public/releases.json, takes the
 * 10 newest items, and writes them as semantic HTML (<ol> of <article>s) plus
 * a schema.org ItemList JSON-LD block between the
 * `<!-- prerender:start -->` / `<!-- prerender:end -->` markers inside
 * index.html's #root div. React replaces the contents of #root on mount, so
 * the block is only ever seen by crawlers and no-JS visitors.
 *
 * Idempotent: re-running replaces the previous block. Run it after every feed
 * refresh (`npm run refresh && npm run prerender`) so the committed index.html
 * stays in sync with public/releases.json.
 *
 * No dependencies — plain Node (>=18).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_PATH = resolve(ROOT, 'public', 'releases.json');
const INDEX_PATH = resolve(ROOT, 'index.html');

const TOP_N = 10;
const START = '<!-- prerender:start -->';
const END = '<!-- prerender:end -->';

/** Minimal HTML entity escaping for text and attribute values. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Load, validate, and return the TOP_N newest releases. */
function loadTopReleases() {
  const raw = JSON.parse(readFileSync(RELEASES_PATH, 'utf8'));
  // Accept both shapes: a bare array, or a { generatedAt, releases } wrapper.
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.releases) ? raw.releases : null;
  if (!items) {
    throw new Error('public/releases.json: expected an array or a { releases: [...] } object');
  }
  return items
    .filter(
      (r) =>
        r &&
        typeof r.title === 'string' &&
        r.title.trim() !== '' &&
        typeof r.url === 'string' &&
        r.url.startsWith('https://') &&
        typeof r.date === 'string' &&
        !Number.isNaN(Date.parse(r.date)),
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, TOP_N);
}

/** Render one release as a list item with a semantic <article>. */
function renderArticle(r) {
  const iso = new Date(r.date).toISOString();
  const day = iso.slice(0, 10);
  const lab = typeof r.lab === 'string' ? r.lab : '';
  const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
  const lines = [
    '          <li>',
    '            <article>',
    `              <h3><a href="${escapeHtml(r.url)}">${escapeHtml(r.title)}</a></h3>`,
  ];
  if (summary) lines.push(`              <p>${escapeHtml(summary)}</p>`);
  lines.push(
    `              <p><time datetime="${iso}">${day}</time>${lab ? ` — ${escapeHtml(lab)}` : ''}</p>`,
    '            </article>',
    '          </li>',
  );
  return lines.join('\n');
}

/** schema.org ItemList for the same top stories. */
function renderJsonLd(items) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Latest AI releases',
    description: 'The newest model, feature, API, and research releases from the top AI labs.',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.length,
    itemListElement: items.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.title,
      url: r.url,
    })),
  };
  // <-escape so no `</script>` sequence can break out of the tag.
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `        <script type="application/ld+json">\n${json}\n        </script>`;
}

function buildBlock(items) {
  return [
    '      <section aria-label="Latest AI releases">',
    '        <h1>AI Pulse — The AI Newswire</h1>',
    '        <p>Every model, feature, API, and paper from the top AI labs, tracked daily.</p>',
    '        <h2>Latest releases</h2>',
    '        <ol>',
    items.map(renderArticle).join('\n'),
    '        </ol>',
    renderJsonLd(items),
    '      </section>',
  ].join('\n');
}

function main() {
  const items = loadTopReleases();
  if (items.length === 0) {
    throw new Error('public/releases.json: no valid releases to prerender');
  }

  const html = readFileSync(INDEX_PATH, 'utf8');
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`index.html: missing ${START} / ${END} markers inside <div id="root">`);
  }

  const next =
    html.slice(0, startIdx + START.length) +
    '\n' +
    buildBlock(items) +
    '\n      ' +
    html.slice(endIdx);

  if (next === html) {
    console.log('prerender: index.html already up to date');
    return;
  }
  writeFileSync(INDEX_PATH, next);
  console.log(
    `prerender: injected ${items.length} headlines into index.html (newest: ${items[0].date})`,
  );
}

main();
