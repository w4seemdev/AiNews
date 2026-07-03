import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, Inbox, SearchX, TriangleAlert, X } from 'lucide-react'
import { releases as sampleReleases } from '../data/releases'
import type { Lab, Release } from '../types'
import FilterBar, { type Filter } from './FilterBar'
import LeadStory from './LeadStory'
import NewsRow from './NewsRow'
import SearchToolbar, { type Density } from './SearchToolbar'
import Sidebar from './Sidebar'
import {
  DENSITY_KEY,
  READ_KEY,
  SAVED_KEY,
  loadSet,
  loadString,
  saveSet,
  saveString,
} from '../lib/storage'
import { sanitizeReleases } from '../lib/validate'

const PAGE = 12

// ---- Date bucket helpers ----

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dateBucket(iso: string, now: number): string {
  const item = new Date(iso)
  if (Number.isNaN(item.getTime())) return 'Earlier'

  const todayStart = startOfDay(new Date(now))
  const itemStart = startOfDay(item)
  const diffDays = Math.round((todayStart - itemStart) / 86400000)

  // diffDays <= 0 also catches slightly future-dated items (feed timezone skew).
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'

  // Older: "Jun 18", with the year appended once it differs from the current one.
  const sameYear = item.getFullYear() === new Date(now).getFullYear()
  return item.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// Stable bucket order
function bucketOrder(bucket: string): number {
  if (bucket === 'Today') return 0
  if (bucket === 'Yesterday') return 1
  if (bucket === 'This week') return 2
  return 100
}

interface Group {
  label: string
  items: Release[]
}

function groupByDate(releases: Release[], now: number): Group[] {
  const map: Record<string, Release[]> = {}
  for (const r of releases) {
    const b = dateBucket(r.date, now)
    if (!map[b]) map[b] = []
    map[b].push(r)
  }

  // Sort groups: Today → Yesterday → This week → older (newest first)
  const entries = Object.entries(map).sort(([aLabel, aItems], [bLabel, bItems]) => {
    const ao = bucketOrder(aLabel)
    const bo = bucketOrder(bLabel)
    if (ao !== bo) return ao - bo
    // Both are "older" date strings: compare by most recent item
    return new Date(bItems[0].date).getTime() - new Date(aItems[0].date).getTime()
  })

  return entries.map(([label, items]) => ({ label, items }))
}

// ---- Search ----

function matchesQuery(r: Release, q: string): boolean {
  const haystack = [r.title, r.summary, r.lab, ...(r.tags ?? [])]
    .join(' ')
    .toLowerCase()
  // Every whitespace-separated term must appear somewhere.
  return q.split(/\s+/).every((term) => haystack.includes(term))
}

// ---- Component ----

export default function Feed() {
  const [data, setData] = useState<Release[] | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [fallbackDismissed, setFallbackDismissed] = useState(false)
  const [active, setActive] = useState<Filter>('all')
  const [activeLab, setActiveLab] = useState<Lab | null>(null)
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const [now, setNow] = useState(() => Date.now())
  const [density, setDensity] = useState<Density>(() =>
    loadString(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable',
  )
  const [saved, setSaved] = useState<Set<string>>(() => loadSet(SAVED_KEY))
  const [read, setRead] = useState<Set<string>>(() => loadSet(READ_KEY))

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/releases.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: unknown = await res.json()
        const list = sanitizeReleases(json)
        if (list.length === 0) throw new Error('Empty or malformed feed')
        if (!cancelled) setData(list)
      } catch {
        if (!cancelled) {
          setData(sampleReleases)
          setUsedFallback(true)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Keep relative timestamps fresh while the tab stays open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Sort newest first
  const sorted = useMemo(
    () => [...(data ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data],
  )

  const q = query.trim().toLowerCase()

  // Search applies first; every other dimension composes on top of it.
  const bySearch = useMemo(
    () => (q ? sorted.filter((r) => matchesQuery(r, q)) : sorted),
    [sorted, q],
  )

  const byLab = useMemo(
    () => (activeLab ? bySearch.filter((r) => r.lab === activeLab) : bySearch),
    [bySearch, activeLab],
  )

  // Category / saved filter applied last.
  const filtered = useMemo(() => {
    if (active === 'all') return byLab
    if (active === 'saved') return byLab.filter((r) => saved.has(r.id))
    return byLab.filter((r) => r.category === active)
  }, [byLab, active, saved])

  // Category counts reflect the current search + lab scope.
  const counts = useMemo(() => {
    const c: Partial<Record<Filter, number>> = { all: byLab.length, saved: 0 }
    for (const r of byLab) {
      c[r.category] = (c[r.category] ?? 0) + 1
      if (saved.has(r.id)) c.saved = (c.saved ?? 0) + 1
    }
    return c
  }, [byLab, saved])

  // Lab counts reflect the current search + category scope.
  const labCounts = useMemo(() => {
    const scope =
      active === 'all'
        ? bySearch
        : active === 'saved'
          ? bySearch.filter((r) => saved.has(r.id))
          : bySearch.filter((r) => r.category === active)
    const map = new Map<Lab, number>()
    for (const r of scope) map.set(r.lab, (map.get(r.lab) ?? 0) + 1)
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([lab, count]) => ({ lab, count }))
  }, [bySearch, active, saved])

  // Lead story only when browsing the unfiltered river.
  const browsing = active === 'all' && activeLab === null && q === ''
  const lead = browsing && sorted.length > 0 ? sorted[0] : null
  const riverAll = useMemo(
    () => (lead ? filtered.filter((r) => r.id !== lead.id) : filtered),
    [filtered, lead],
  )
  const riverVisible = useMemo(() => riverAll.slice(0, visible), [riverAll, visible])
  const groups = useMemo(() => groupByDate(riverVisible, now), [riverVisible, now])

  // Pager counts include the lead story so they agree with the sidebar tallies.
  const shownCount = riverVisible.length + (lead ? 1 : 0)
  const totalCount = riverAll.length + (lead ? 1 : 0)

  function handleFilterChange(c: Filter) {
    setActive(c)
    setVisible(PAGE)
  }

  function handleLabChange(lab: Lab | null) {
    setActiveLab(lab)
    setVisible(PAGE)
  }

  function handleQueryChange(next: string) {
    setQuery(next)
    setVisible(PAGE)
  }

  function handleDensityChange(d: Density) {
    setDensity(d)
    saveString(DENSITY_KEY, d)
  }

  // Stable identities so memo(NewsRow) actually skips unchanged rows.
  const toggleSave = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveSet(SAVED_KEY, next)
      return next
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setRead((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveSet(READ_KEY, next)
      return next
    })
  }, [])

  function clearFilters() {
    setQuery('')
    setActive('all')
    setActiveLab(null)
    setVisible(PAGE)
  }

  if (data === null) {
    return (
      <div className="layout">
        <main className="layout__main" id="main-content" tabIndex={-1} aria-busy="true">
          <div className="loading-state" role="status">Loading latest releases…</div>
          <div className="skeleton-river" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div className="skeleton-row" key={i}>
                <div className="skeleton skeleton--thumb" />
                <div className="skeleton-row__body">
                  <div className="skeleton skeleton--meta" />
                  <div className="skeleton skeleton--title" />
                  <div className="skeleton skeleton--dek" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  const emptyMessage =
    active === 'saved' && saved.size === 0
      ? 'Nothing saved yet — tap the bookmark on any story to read it later.'
      : q !== ''
        ? `No releases match “${query.trim()}”.`
        : activeLab
          ? `No ${active === 'all' ? '' : active + ' '}releases from ${activeLab} yet.`
          : active === 'saved'
            ? 'None of your saved stories are in the current feed.'
            : 'No releases in this category yet.'

  return (
    <div className="layout">
      {/* Main column */}
      <main className="layout__main" id="main-content" tabIndex={-1}>
        {usedFallback && !fallbackDismissed && (
          <div className="fallback-note" role="status">
            <TriangleAlert size={14} aria-hidden="true" />
            <span className="fallback-note__text">
              Live feed unavailable — showing sample data.
            </span>
            <button
              type="button"
              className="fallback-note__close"
              onClick={() => setFallbackDismissed(true)}
              aria-label="Dismiss notice"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Mobile chip filter bar */}
        <FilterBar
          active={active}
          onChange={handleFilterChange}
          counts={counts}
          variant="chips"
        />

        {/* Search + density toolbar */}
        <SearchToolbar
          query={query}
          onQueryChange={handleQueryChange}
          density={density}
          onDensityChange={handleDensityChange}
          resultCount={riverAll.length}
        />

        {/* Lead story (newest, only on the unfiltered view) */}
        {lead && (
          <LeadStory
            release={lead}
            now={now}
            isSaved={saved.has(lead.id)}
            onToggleSave={toggleSave}
            onMarkRead={markRead}
          />
        )}

        {/* River: date-grouped rows */}
        {riverAll.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              {active === 'saved' ? (
                <Bookmark size={24} />
              ) : q !== '' ? (
                <SearchX size={24} />
              ) : (
                <Inbox size={24} />
              )}
            </div>
            <p>{emptyMessage}</p>
            {(q !== '' || active !== 'all' || activeLab !== null) && (
              <button type="button" className="empty-state__clear" onClick={clearFilters}>
                Clear search &amp; filters
              </button>
            )}
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="date-group">
                  <span className="date-group__label">
                    {group.label}
                    <span className="date-group__count" aria-label={`${group.items.length} ${group.items.length === 1 ? 'story' : 'stories'}`}>
                      {group.items.length}
                    </span>
                  </span>
                </h2>
                <div className={'river' + (density === 'compact' ? ' river--compact' : '')}>
                  {group.items.map((r) => (
                    <NewsRow
                      key={r.id}
                      release={r}
                      now={now}
                      isSaved={saved.has(r.id)}
                      isRead={read.has(r.id)}
                      onToggleSave={toggleSave}
                      onMarkRead={markRead}
                    />
                  ))}
                </div>
              </section>
            ))}

            {visible < riverAll.length && (
              <div className="load-more-wrap">
                <button
                  className="load-more-btn"
                  onClick={() => setVisible((v) => v + PAGE)}
                  aria-label={`Load more releases (${riverAll.length - visible} remaining)`}
                >
                  Load more
                </button>
                <span className="load-more-count">
                  Showing {shownCount} of {totalCount}
                </span>
              </div>
            )}
          </>
        )}
      </main>

      {/* Sidebar — desktop only (hidden via CSS on mobile) */}
      <Sidebar
        active={active}
        onChange={handleFilterChange}
        counts={counts}
        labCounts={labCounts}
        activeLab={activeLab}
        onLabChange={handleLabChange}
        trending={sorted}
        now={now}
      />
    </div>
  )
}
