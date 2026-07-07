import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getBool, getEnum, setBool, setEnum, PARAM } from '@/shared/lib/filter-codec'

const SORT_FIELDS = ['number', 'status', 'priority', 'createdAt', 'dueDate'] as const
const VIEW_MODES = ['list', 'grouped'] as const

export type SortField = (typeof SORT_FIELDS)[number]
export type SortOrder = 'asc' | 'desc'
export type ViewMode = (typeof VIEW_MODES)[number]

/**
 * Encapsulates the page-level URL state: sort, view mode, archived flag.
 * Sort is stored in the shared `?sort=field:dir` param (multi-field
 * codec) so the SortMenu and column-header click stay in sync — Phase 1
 * still surfaces the first entry as the single sortBy/sortOrder pair the
 * IssuesTable + Toolbar already consume.
 */
export function useIssueListUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read the first entry of the multi-field sort stack. No `sort` param
  // in the URL means a fresh page load — default to newest-created-first
  // rather than leaving the list unsorted.
  const sortRaw = searchParams.get(PARAM.sort)
  const firstSort = sortRaw?.split(',')[0]?.split(':') as [string, string | undefined] | undefined
  const sortBy: SortField | '' =
    firstSort && (SORT_FIELDS as readonly string[]).includes(firstSort[0])
      ? (firstSort[0] as SortField)
      : 'createdAt'
  const sortOrder: SortOrder = firstSort?.[1] === 'asc' ? 'asc' : 'desc'
  const viewMode = getEnum(searchParams, PARAM.view, VIEW_MODES, 'list')
  const showArchived = getBool(searchParams, PARAM.archived, false)

  const mutateParams = useCallback(
    (mutator: (p: URLSearchParams) => void) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        mutator(next)
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const setViewMode = useCallback((mode: ViewMode) => {
    mutateParams((p) => setEnum(p, PARAM.view, mode, 'list'))
  }, [mutateParams])

  const setShowArchived = useCallback((value: boolean) => {
    mutateParams((p) => setBool(p, PARAM.archived, value, false))
  }, [mutateParams])

  const toggleSort = useCallback((field: SortField) => {
    // Single-field column click writes a 1-entry stack so the URL stays
    // compatible with the SortMenu reader (`field:dir`).
    const nextDir: SortOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc'
    mutateParams((p) => p.set(PARAM.sort, `${field}:${nextDir}`))
  }, [sortBy, sortOrder, mutateParams])

  return { sortBy, sortOrder, viewMode, showArchived, setViewMode, setShowArchived, toggleSort }
}
