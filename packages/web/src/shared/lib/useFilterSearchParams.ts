// Hook: sync FilterState (+ optional page extras) with URL search params.
//
// Reads on mount; writes with replace:true so each keystroke doesn't add a
// history entry. Search field is debounced to keep the URL stable while typing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { INITIAL_FILTER, type FilterState } from '@/shared/ui/filterState'
import { deserializeFilter, serializeFilter } from '@/shared/lib/filter-codec'

const SEARCH_DEBOUNCE_MS = 300

export interface FilterControls {
  filters: FilterState
  setFilters: (patch: Partial<FilterState>) => void
  resetFilters: () => void
  // Direct setter — same shape as the original useState; useful for callbacks
  // already shaped as `setFilters((prev) => ({ ...prev, x: ... }))`.
  setFiltersFull: (next: FilterState | ((prev: FilterState) => FilterState)) => void
}

/**
 * Bind FilterState to the URL. Page-specific extras (showArchived, viewMode,
 * sortBy, etc.) should be handled via a sibling hook or by calling
 * `mutateSearchParams` returned from useSearchParams directly — keeping this
 * hook focused on the shared FilterState shape.
 */
export function useFilterSearchParams(): FilterControls {
  const [searchParams, setSearchParams] = useSearchParams()
  // Hydrate from URL on first render only.
  const [filters, setFiltersState] = useState<FilterState>(() =>
    deserializeFilter(searchParams),
  )

  // Refs for the debounced search write
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestFiltersRef = useRef<FilterState>(filters)
  latestFiltersRef.current = filters

  // Sync state ← URL when the URL changes externally (back/forward, deep link).
  useEffect(() => {
    const urlState = deserializeFilter(searchParams)
    // Avoid loops: only update if the URL diverges from the current state.
    if (!sameFilter(urlState, latestFiltersRef.current)) {
      setFiltersState(urlState)
    }
  }, [searchParams])

  const writeToUrl = useCallback(
    (next: FilterState, immediate = true) => {
      const apply = () => {
        setSearchParams(
          (prev) => {
            // Preserve any non-filter params already on the URL (e.g. ?open=...).
            const merged = new URLSearchParams(prev)
            return serializeFilter(next, merged)
          },
          { replace: true },
        )
      }
      if (immediate) {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        apply()
      } else {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(apply, SEARCH_DEBOUNCE_MS)
      }
    },
    [setSearchParams],
  )

  const setFilters = useCallback(
    (patch: Partial<FilterState>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...patch }
        // Debounce only when the only thing that changed is the search text.
        const onlySearchChanged =
          Object.keys(patch).length === 1 && 'search' in patch
        writeToUrl(next, !onlySearchChanged)
        return next
      })
    },
    [writeToUrl],
  )

  const setFiltersFull = useCallback(
    (next: FilterState | ((prev: FilterState) => FilterState)) => {
      setFiltersState((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: FilterState) => FilterState)(prev) : next
        writeToUrl(resolved, true)
        return resolved
      })
    },
    [writeToUrl],
  )

  const resetFilters = useCallback(() => {
    setFiltersFull(INITIAL_FILTER)
  }, [setFiltersFull])

  // Flush any pending debounced write on unmount so we don't drop a stroke.
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  return useMemo(
    () => ({ filters, setFilters, setFiltersFull, resetFilters }),
    [filters, setFilters, setFiltersFull, resetFilters],
  )
}

function sameFilter(a: FilterState, b: FilterState): boolean {
  return (
    sameSet(a.assignees, b.assignees) &&
    sameSet(a.labels, b.labels) &&
    sameSet(a.components, b.components) &&
    a.epicId === b.epicId &&
    sameSet(a.status, b.status) &&
    sameSet(a.priority, b.priority) &&
    sameSet(a.type, b.type) &&
    a.search === b.search
  )
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
