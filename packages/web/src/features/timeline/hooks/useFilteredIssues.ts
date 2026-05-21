import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import type { FilterState } from '@/shared/ui/filterState'
/**
 * Applies the shared FilterBar state to a list of issues. `CANCELED` is
 * hidden by default — that matches the convention in the board / list
 * views: cancelled work doesn't belong on a timeline unless you opt in.
 *
 * `DOMAIN` (Module) is also hidden by default — it's an organisational
 * row, not a work item, and shouldn't appear in Calendar chips, Timeline
 * lanes, or any planning surface. The user can opt-in by explicitly
 * adding `DOMAIN` to the `type` filter (e.g. to see Modules on a
 * timeline lane), in which case we honour the explicit choice.
 */
export function useFilteredIssues(allIssues: Issue[], filters: FilterState): Issue[] {
  return useMemo(() => {
    const searchLower = filters.search.toLowerCase()
    return allIssues.filter((issue) => {
      if (issue.type === 'DOMAIN' && !filters.type.has('DOMAIN')) return false
      if (issue.status === 'CANCELED' && !filters.status.has('CANCELED')) return false
      if (filters.status.size > 0 && !filters.status.has(issue.status)) return false
      if (filters.priority.size > 0 && !filters.priority.has(issue.priority)) return false
      if (filters.type.size > 0 && !filters.type.has(issue.type)) return false
      if (filters.assignees.size > 0 && (!issue.assigneeId || !filters.assignees.has(issue.assigneeId))) return false
      if (filters.search && !issue.title.toLowerCase().includes(searchLower) && !String(issue.number).includes(filters.search)) return false
      return true
    })
  }, [allIssues, filters])
}
