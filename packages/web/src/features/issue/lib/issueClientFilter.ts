import type { Issue } from '@/features/issue/api'
import type { FilterState } from '@/shared/ui/filterState'
/**
 * Re-applies filters the server can't enforce (label/component multi-
 * select, multi-status, multi-priority, multi-type) on top of the
 * server-side query. CANCELED is hidden by default — opt in via the
 * Status filter.
 */
export function applyClientFilters(items: Issue[] | undefined, filters: FilterState): Issue[] {
  if (!items) return []
  let result = items

  if (filters.labels.size > 0) {
    result = result.filter((issue) => issue.labels.some((il) => filters.labels.has(il.label.id)))
  }
  if (filters.components.size > 0) {
    result = result.filter((issue) => issue.components?.some((ic) => filters.components.has(ic.component.id)))
  }
  if (!filters.status.has('CANCELED')) {
    result = result.filter((issue) => issue.status !== 'CANCELED')
  }
  if (filters.status.size > 1) result = result.filter((issue) => filters.status.has(issue.status))
  if (filters.priority.size > 1) result = result.filter((issue) => filters.priority.has(issue.priority))
  if (filters.type.size > 1) result = result.filter((issue) => filters.type.has(issue.type))

  return result
}

/**
 * Builds the server-side query param dict. The server only handles
 * single-value status/priority/type/assignee, so larger sets fall back
 * to client-side filtering.
 */
export function buildListParams(opts: {
  search: string
  filters: FilterState
  showArchived: boolean
  sortBy: string
  sortOrder: string
  viewMode: 'list' | 'grouped'
}): Record<string, string> {
  const { search, filters, showArchived, sortBy, sortOrder, viewMode } = opts
  const params: Record<string, string> = { limit: '200' }
  if (showArchived) params.includeArchived = 'true'
  if (search) params.search = search
  if (filters.status.size === 1) params.status = [...filters.status][0]
  if (filters.priority.size === 1) params.priority = [...filters.priority][0]
  if (filters.type.size === 1) params.type = [...filters.type][0]
  const firstAssignee = [...filters.assignees][0]
  if (firstAssignee) params.assigneeId = firstAssignee
  if (viewMode === 'list' && sortBy) {
    params.sortBy = sortBy
    params.sortOrder = sortOrder
  }
  return params
}
