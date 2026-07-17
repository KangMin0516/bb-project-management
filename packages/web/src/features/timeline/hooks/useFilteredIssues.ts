import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import type { FilterState } from '@/shared/ui/filterState'
import {
  applyParsedSearch,
  hasOperators,
  parseSearchQuery,
  type ParseContext,
} from '@/shared/lib/search-query'
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
 *
 * `SUB_TASK` is hidden by default too — the timeline is meant to chart
 * Epic/Task-level work, and sub-tasks add row noise without adding
 * planning value at this zoom level. Same opt-in mechanism: add
 * `SUB_TASK` to the `type` filter to see them.
 *
 * `epicId` / `domainId` walk the parent chain via `parentId` so the
 * filter keeps the matched ancestor itself + every descendant (Epic →
 * Tasks → SubTasks, or Module → Epics → Tasks → SubTasks). Without the
 * walk a Module-filter would only match the Module row itself, leaving
 * the chart empty.
 */
export function useFilteredIssues(
  allIssues: Issue[],
  filters: FilterState,
  parseCtx: ParseContext = {},
): Issue[] {
  // PM-78: search input supports operators (`assignee:me status:open …`).
  // Parse on the fly, AND-merge with popover-set filters.
  const effective = useMemo(() => {
    if (!hasOperators(filters.search)) return filters
    const parsed = parseSearchQuery(filters.search, parseCtx)
    return applyParsedSearch(filters, parsed)
  }, [filters, parseCtx])

  return useMemo(() => {
    const searchLower = effective.search.toLowerCase()
    const byId = new Map(allIssues.map((i) => [i.id, i]))

    const isDescendantOf = (issue: Issue, ancestorId: string): boolean => {
      if (issue.id === ancestorId) return true
      let cursor: Issue | undefined = issue
      while (cursor?.parentId) {
        if (cursor.parentId === ancestorId) return true
        cursor = byId.get(cursor.parentId)
      }
      return false
    }

    return allIssues.filter((issue) => {
      if (issue.type === 'DOMAIN' && !effective.type.has('DOMAIN')) return false
      if (issue.type === 'SUB_TASK' && !effective.type.has('SUB_TASK')) return false
      if (issue.status === 'CANCELED' && !effective.status.has('CANCELED')) return false
      if (effective.status.size > 0 && !effective.status.has(issue.status)) return false
      if (effective.priority.size > 0 && !effective.priority.has(issue.priority)) return false
      if (effective.type.size > 0 && !effective.type.has(issue.type)) return false
      if (effective.source.size > 0 && !effective.source.has(issue.source)) return false
      if (effective.assignees.size > 0 && (!issue.assigneeId || !effective.assignees.has(issue.assigneeId))) return false
      if (effective.reviewers.size > 0 && (!issue.reviewerAssigneeId || !effective.reviewers.has(issue.reviewerAssigneeId))) return false
      if (effective.creators.size > 0 && !effective.creators.has(issue.creatorId)) return false
      if (effective.epicId && !isDescendantOf(issue, effective.epicId)) return false
      if (effective.domainId && !isDescendantOf(issue, effective.domainId)) return false
      if (effective.labels.size > 0 && !issue.labels.some((l) => effective.labels.has(l.label.id))) return false
      if (effective.components.size > 0 && !issue.components.some((c) => effective.components.has(c.component.id))) return false
      if (effective.search && !issue.title.toLowerCase().includes(searchLower) && !String(issue.number).includes(effective.search)) return false
      return true
    })
  }, [allIssues, effective])
}
