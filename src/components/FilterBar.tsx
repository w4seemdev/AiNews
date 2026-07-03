import { Bookmark } from 'lucide-react'
import type { Category } from '../types'

export type Filter = Category | 'all' | 'saved'

export const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'model', label: 'Models' },
  { value: 'feature', label: 'Features' },
  { value: 'api', label: 'API' },
  { value: 'research', label: 'Research' },
  { value: 'saved', label: 'Saved' },
]

interface FilterBarProps {
  active: Filter
  onChange: (c: Filter) => void
  counts?: Partial<Record<Filter, number>>
  /** When 'sidebar', renders as the sidebar vertical list; default = mobile chip bar */
  variant?: 'sidebar' | 'chips'
}

export default function FilterBar({ active, onChange, counts, variant = 'chips' }: FilterBarProps) {
  if (variant === 'sidebar') {
    return (
      <div className="sidebar__filter-list" role="group" aria-label="Filter releases by category">
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={active === o.value}
            className={'sidebar__filter-btn' + (active === o.value ? ' active' : '')}
            onClick={() => onChange(o.value)}
          >
            <span className="sidebar__filter-label">
              {o.value === 'saved' && (
                <Bookmark
                  size={12}
                  aria-hidden="true"
                  fill={(counts?.saved ?? 0) > 0 ? 'currentColor' : 'none'}
                />
              )}
              {o.label}
            </span>
            {counts?.[o.value] != null && (
              <span className="sidebar__filter-count">{counts[o.value]}</span>
            )}
          </button>
        ))}
      </div>
    )
  }

  // Mobile chip bar
  return (
    <div className="mobile-filter-bar" role="group" aria-label="Filter releases by category">
      {FILTER_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={active === o.value}
          className={'mobile-chip' + (active === o.value ? ' active' : '')}
          onClick={() => onChange(o.value)}
        >
          {o.value === 'saved' && (
            <Bookmark
              size={11}
              aria-hidden="true"
              fill={(counts?.saved ?? 0) > 0 ? 'currentColor' : 'none'}
            />
          )}
          {o.label}
          {counts?.[o.value] != null && (
            <span className="mobile-chip__count">{counts[o.value]}</span>
          )}
        </button>
      ))}
    </div>
  )
}
