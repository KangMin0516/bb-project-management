import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getBool, getEnum, setBool, setEnum, PARAM } from '@/shared/lib/filter-codec'

const SORT_FIELDS = ['number', 'status', 'priority', 'createdAt', 'dueDate'] as const
const SORT_ORDERS = ['asc', 'desc'] as const
const VIEW_MODES = ['list', 'grouped'] as const

export type SortField = (typeof SORT_FIELDS)[number]
export type SortOrder = (typeof SORT_ORDERS)[number]
export type ViewMode = (typeof VIEW_MODES)[number]

/**
 * Encapsulates the page-level URL state: sort, view mode, archived flag.
 * Each setter writes through `setSearchParams(replace)` so the back-stack
 * doesn't fill up with every filter tweak.
 */
export function useIssueListUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()

  const sortBy = getEnum(searchParams, PARAM.sort, [...SORT_FIELDS, ''] as const, '' as SortField | '')
  const sortOrder = getEnum(searchParams, PARAM.order, SORT_ORDERS, 'desc')
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
    if (sortBy === field) {
      mutateParams((p) => setEnum(p, PARAM.order, sortOrder === 'asc' ? 'desc' : 'asc', 'desc'))
    } else {
      mutateParams((p) => {
        setEnum(p, PARAM.sort, field, '' as SortField | '')
        setEnum(p, PARAM.order, 'desc' as const, 'desc' as const)
      })
    }
  }, [sortBy, sortOrder, mutateParams])

  return { sortBy, sortOrder, viewMode, showArchived, setViewMode, setShowArchived, toggleSort }
}
