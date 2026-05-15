import type { Issue } from '@/features/issue/api'
import type { FilterState } from '@/shared/ui/filterState'
/**
 * Re-applies filters the server can't enforce (label/component multi-
 * select, multi-status, multi-priority, multi-type, multi-assignee with
 * ancestor inclusion, archived-only view) on top of the server-side
 * query. CANCELED is hidden by default — opt in via the Status filter.
 */
export function applyClientFilters(
  items: Issue[] | undefined,
  filters: FilterState,
  opts: { showArchived?: boolean } = {},
): Issue[] {
  if (!items) return []
  let result = items

  // Archived toggle is a *view switch*, not a superset:
  //   off → only active issues (server already excludes via archivedAt:null)
  //   on  → only archived issues
  if (opts.showArchived) {
    result = result.filter((issue) => issue.archivedAt != null)
  }

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

  // Assignee filter: include any issue whose assignee matches AND every
  // ancestor of those matches, so root tasks stay visible when a subtask
  // is the actual hit.
  if (filters.assignees.size > 0) {
    const byId = new Map(items.map((i) => [i.id, i]))
    const keep = new Set<string>()
    for (const issue of result) {
      if (issue.assigneeId && filters.assignees.has(issue.assigneeId)) {
        keep.add(issue.id)
        let parentId = issue.parentId
        while (parentId && byId.has(parentId) && !keep.has(parentId)) {
          keep.add(parentId)
          parentId = byId.get(parentId)!.parentId
        }
      }
    }
    result = result.filter((i) => keep.has(i.id))
  }

  return result
}

/**
 * Builds the server-side query param dict. Multi-value filters
 * (assignee, status, priority, type) fall back to client-side filtering
 * — see applyClientFilters.
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
  // Always fetch archived when the toggle is on — client-side narrows
  // it down to archived-only.
  if (showArchived) params.includeArchived = 'true'
  if (search) params.search = search
  if (filters.status.size === 1) params.status = [...filters.status][0]
  if (filters.priority.size === 1) params.priority = [...filters.priority][0]
  if (filters.type.size === 1) params.type = [...filters.type][0]
  // Assignee filter is fully client-side so we can include ancestor
  // tasks whose subtasks match — sending it to the server would prune
  // those parents before we ever see them.
  if (viewMode === 'list' && sortBy) {
    params.sortBy = sortBy
    params.sortOrder = sortOrder
  }
  return params
}
