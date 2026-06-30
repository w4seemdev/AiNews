import type { Release } from '../types'
import FilterBar, { type Filter } from './FilterBar'
import { labColor, relativeTime, fullDate } from './LeadStory'

interface SidebarProps {
  active: Filter
  onChange: (c: Filter) => void
  counts: Record<string, number>
  allReleases: Release[]
}

interface LabCount {
  lab: string
  count: number
}

export default function Sidebar({ active, onChange, counts, allReleases }: SidebarProps) {
  // Tally sources
  const labMap: Record<string, number> = {}
  for (const r of allReleases) {
    labMap[r.lab] = (labMap[r.lab] || 0) + 1
  }
  const labCounts: LabCount[] = Object.entries(labMap)
    .sort((a, b) => b[1] - a[1])
    .map(([lab, count]) => ({ lab, count }))

  // 5 most recent for trending
  const trending = [...allReleases]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  // This-week window
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = trending.filter((r) => new Date(r.date).getTime() >= oneWeekAgo)
  const trendItems = thisWeek.length >= 3 ? thisWeek : trending

  return (
    <aside className="sidebar" aria-label="Sidebar">
      {/* 1 — Filter panel */}
      <div className="sidebar__panel">
        <div className="sidebar__title">Filter</div>
        <FilterBar
          active={active}
          onChange={onChange}
          counts={counts}
          variant="sidebar"
        />
      </div>

      {/* 2 — Sources panel */}
      <div className="sidebar__panel">
        <div className="sidebar__title">Sources</div>
        <div className="sidebar__source-list">
          {labCounts.map(({ lab, count }) => (
            <div className="sidebar__source-row" key={lab}>
              <div className="sidebar__source-left">
                <span
                  className="source-dot"
                  style={{ background: labColor(lab) }}
                  aria-hidden="true"
                />
                <span>{lab}</span>
              </div>
              <span className="sidebar__source-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3 — Trending panel */}
      <div className="sidebar__panel">
        <div className="sidebar__title">Trending this week</div>
        <div className="sidebar__trend-list">
          {trendItems.map((r) => {
            const color = labColor(r.lab)
            const TrendWrapper = r.url ? 'a' : 'div'
            const trendProps = r.url
              ? { href: r.url, target: '_blank', rel: 'noopener noreferrer' }
              : {}
            return (
              <TrendWrapper
                key={r.id}
                className="sidebar__trend-item"
                aria-label={r.title}
                {...(trendProps as any)}
              >
                <div className="sidebar__trend-left">
                  <span
                    className="source-dot"
                    style={{ background: color, marginTop: 1 }}
                    aria-hidden="true"
                  />
                </div>
                <div className="sidebar__trend-body">
                  <div className="sidebar__trend-title">{r.title}</div>
                  <time
                    className="sidebar__trend-meta"
                    dateTime={r.date}
                    title={fullDate(r.date)}
                  >
                    {r.lab} · {relativeTime(r.date)}
                  </time>
                </div>
              </TrendWrapper>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
