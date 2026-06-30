import { useEffect, useMemo, useState } from 'react'
import { releases as sampleReleases } from '../data/releases'
import type { Release } from '../types'
import FilterBar, { type Filter } from './FilterBar'
import LeadStory from './LeadStory'
import NewsRow from './NewsRow'
import Sidebar from './Sidebar'

const PAGE = 12

// ---- Date bucket helpers ----

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dateBucket(iso: string): string {
  const now = new Date()
  const todayStart = startOfDay(now)
  const itemStart = startOfDay(new Date(iso))
  const diffDays = Math.round((todayStart - itemStart) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'

  // Older: format as "Jun 18" etc.
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Stable bucket order
function bucketOrder(bucket: string): number {
  if (bucket === 'Today') return 0
  if (bucket === 'Yesterday') return 1
  if (bucket === 'This week') return 2
  // Older buckets — sort by parsed date descending
  return 100
}

interface Group {
  label: string
  items: Release[]
}

function groupByDate(releases: Release[]): Group[] {
  const map: Record<string, Release[]> = {}
  for (const r of releases) {
    const b = dateBucket(r.date)
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

// ---- Component ----

export default function Feed() {
  const [data, setData] = useState<Release[] | null>(null)
  const [active, setActive] = useState<Filter>('all')
  const [visible, setVisible] = useState(PAGE)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/releases.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as Release[]
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData(sampleReleases)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Sort newest first
  const sorted = useMemo(
    () => [...(data ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data],
  )

  // Counts for filter
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sorted.length }
    for (const r of sorted) c[r.category] = (c[r.category] || 0) + 1
    return c
  }, [sorted])

  // Filtered river (excludes the lead item)
  const lead = sorted.length > 0 ? sorted[0] : null
  const riverAll = active === 'all' ? sorted.slice(1) : sorted.filter((r) => r.category === active)
  const riverVisible = riverAll.slice(0, visible)
  const groups = useMemo(() => groupByDate(riverVisible), [riverVisible])

  function handleFilterChange(c: Filter) {
    setActive(c)
    setVisible(PAGE)
  }

  if (data === null) {
    return (
      <div className="layout">
        <main className="layout__main">
          <div className="loading-state">Loading latest releases…</div>
        </main>
      </div>
    )
  }

  return (
    <div className="layout">
      {/* Main column */}
      <main className="layout__main" id="main-content">
        {/* Mobile chip filter bar */}
        <FilterBar
          active={active}
          onChange={handleFilterChange}
          counts={counts}
          variant="chips"
        />

        {/* Lead story (always newest, above filter) */}
        {lead && active === 'all' && <LeadStory release={lead} />}

        {/* River: date-grouped rows */}
        {riverAll.length === 0 ? (
          <div className="empty-state">No releases in this category yet.</div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <div className="date-group" role="heading" aria-level={2}>
                  {group.label}
                </div>
                <div className="river">
                  {group.items.map((r, i) => (
                    <div key={r.id}>
                      {i > 0 && <div className="river__divider" aria-hidden="true" />}
                      <NewsRow release={r} />
                    </div>
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
                  Showing {Math.min(visible, riverAll.length)} of {riverAll.length}
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
        allReleases={sorted}
      />
    </div>
  )
}
