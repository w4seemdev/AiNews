import { useEffect, useRef } from 'react'
import { AlignJustify, LayoutList, Search, X } from 'lucide-react'

export type Density = 'comfortable' | 'compact'

interface SearchToolbarProps {
  query: string
  onQueryChange: (q: string) => void
  density: Density
  onDensityChange: (d: Density) => void
  resultCount: number
}

/**
 * Search input + density (headlines-only) toggle shown above the river.
 * Pressing "/" anywhere on the page focuses the search box; Escape clears it.
 */
export default function SearchToolbar({
  query,
  onQueryChange,
  density,
  onDensityChange,
  resultCount,
}: SearchToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const compact = density === 'compact'

  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <Search size={14} className="toolbar__search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="toolbar__input"
          placeholder="Search releases…"
          aria-label="Search releases by title, summary, lab, or tag"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onQueryChange('')
              e.currentTarget.blur()
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="toolbar__clear"
            onClick={() => {
              onQueryChange('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : (
          <kbd className="toolbar__kbd" aria-hidden="true">/</kbd>
        )}
      </div>

      {query && (
        <span className="toolbar__count" role="status">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      )}

      <button
        type="button"
        className="toolbar__density"
        onClick={() => onDensityChange(compact ? 'comfortable' : 'compact')}
        aria-pressed={compact}
        title={compact ? 'Switch to comfortable view' : 'Switch to headlines-only view'}
        aria-label={compact ? 'Switch to comfortable view' : 'Switch to headlines-only view'}
      >
        {compact ? <LayoutList size={14} aria-hidden="true" /> : <AlignJustify size={14} aria-hidden="true" />}
        <span className="toolbar__density-label">{compact ? 'Comfortable' : 'Headlines'}</span>
      </button>
    </div>
  )
}
