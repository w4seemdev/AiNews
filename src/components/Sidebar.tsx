import { Clock, Filter as FilterIcon, Radio } from 'lucide-react'
import type { Lab, Release } from '../types'
import FilterBar, { type Filter } from './FilterBar'
import NewsletterSignup from './NewsletterSignup'
import { fullDate, labColor, relativeTime } from '../lib/format'

interface LabCount {
  lab: Lab
  count: number
}

interface SidebarProps {
  active: Filter
  onChange: (c: Filter) => void
  counts: Partial<Record<Filter, number>>
  labCounts: LabCount[]
  activeLab: Lab | null
  onLabChange: (lab: Lab | null) => void
  /** Full newest-first release list — used for the Latest panel only. */
  latest: Release[]
  now: number
}

export default function Sidebar({
  active,
  onChange,
  counts,
  labCounts,
  activeLab,
  onLabChange,
  latest,
  now,
}: SidebarProps) {
  // Honest label, honest logic: simply the 5 newest stories.
  const latestItems = latest.slice(0, 5)

  return (
    <aside className="sidebar" aria-label="Filters, sources, and latest stories">
      {/* 1 — Filter panel (hidden on mobile — the chip bar covers it) */}
      <div className="sidebar__panel sidebar__panel--filter">
        <h2 className="sidebar__title">
          <FilterIcon size={14} aria-hidden="true" />
          Filter
        </h2>
        <FilterBar
          active={active}
          onChange={onChange}
          counts={counts}
          variant="sidebar"
        />
      </div>

      {/* 2 — Sources panel (clickable lab filter) */}
      <div className="sidebar__panel">
        <h2 className="sidebar__title">
          <Radio size={14} aria-hidden="true" />
          Sources
        </h2>
        <div className="sidebar__source-list" role="group" aria-label="Filter releases by lab">
          {labCounts.map(({ lab, count }) => {
            const selected = activeLab === lab
            return (
              <button
                key={lab}
                type="button"
                className={'sidebar__source-row' + (selected ? ' active' : '')}
                aria-pressed={selected}
                onClick={() => onLabChange(selected ? null : lab)}
                title={selected ? `Stop filtering by ${lab}` : `Show only ${lab} releases`}
              >
                <span className="sidebar__source-left">
                  <span
                    className="source-dot"
                    style={{ background: labColor(lab) }}
                    aria-hidden="true"
                  />
                  <span>{lab}</span>
                </span>
                <span className="sidebar__source-count">{count}</span>
              </button>
            )
          })}
          {activeLab !== null && (
            <button
              type="button"
              className="sidebar__source-clear"
              onClick={() => onLabChange(null)}
            >
              Show all sources
            </button>
          )}
        </div>
      </div>

      {/* 3 — Latest panel */}
      <div className="sidebar__panel">
        <h2 className="sidebar__title">
          <Clock size={14} aria-hidden="true" />
          Latest
        </h2>
        <div className="sidebar__trend-list">
          {latestItems.map((r, i) => {
            const color = labColor(r.lab)
            const body = (
              <>
                <span className="sidebar__trend-rank" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="sidebar__trend-body">
                  <div className="sidebar__trend-title">{r.title}</div>
                  <div className="sidebar__trend-meta">
                    <span
                      className="source-dot source-dot--sm"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                    <span>{r.lab}</span>
                    <span className="meta-sep" aria-hidden="true">·</span>
                    <time dateTime={r.date} title={fullDate(r.date)}>
                      {relativeTime(r.date, now)}
                    </time>
                  </div>
                </div>
              </>
            )
            return r.url ? (
              <a
                key={r.id}
                className="sidebar__trend-item"
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.title}
              >
                {body}
              </a>
            ) : (
              <div key={r.id} className="sidebar__trend-item" aria-label={r.title}>
                {body}
              </div>
            )
          })}
        </div>
      </div>

      {/* 4 — Newsletter panel */}
      <div className="sidebar__panel sidebar__panel--newsletter">
        <NewsletterSignup variant="panel" />
      </div>
    </aside>
  )
}
