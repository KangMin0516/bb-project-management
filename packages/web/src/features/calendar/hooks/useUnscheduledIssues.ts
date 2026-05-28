import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import type { Issue } from '@/features/issue/api'
import type { FilterState } from '@/shared/ui/filterState'

/** Only these statuses appear in the Unscheduled panel — REVIEW_QA / RECHECK / DONE / CANCELED are out of scope. */
const ACTIVE_STATUSES = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS'])
/** DOMAIN (Module) is an organisational row, not a schedulable work item. */
const SCHEDULABLE_TYPES = new Set(['EPIC', 'TASK', 'BUG', 'SUB_TASK'])
const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const FETCH_LIMIT = 200

/**
 * Active tickets in the project that don't have a `dueDate` yet —
 * source for the Calendar's drag-and-drop "Unscheduled" panel (PM-58).
 *
 * BE returns every `dueDate IS NULL` row via `hasDueDate=false`; we
 * narrow to the active statuses client-side because the BE doesn't
 * accept multi-status (and adding it just for this view is overkill —
 * the cap of 200 unscheduled rows is comfortable for any single project).
 *
 * `filters` lets the panel honour whatever filters the user has set
 * on the Calendar header (priority / type / source / assignee). Status
 * filter is intersected with ACTIVE_STATUSES so the panel never shows
 * an out-of-scope row.
 */
export function useUnscheduledIssues(projectId: string, filters: FilterState, _enabled = true) {
  // Always-on: keep the unscheduled cache hot even while the panel is
  // collapsed, otherwise re-opening it shows stale data until the next
  // mutation. The data is small (≤200 rows) and only fetched once per
  // project navigation, so the cost is negligible.
  const query = useQuery({
    queryKey: ['issues', projectId, 'unscheduled'],
    queryFn: () =>
      issueRepository.findInProjectRaw(projectId, {
        limit: String(FETCH_LIMIT),
        hasDueDate: 'false',
      }),
    enabled: !!projectId,
  })

  const items = useMemo(() => query.data?.items ?? [], [query.data])

  const filtered = useMemo<Issue[]>(() => {
    const statusFilter = filters.status
    const priorityFilter = filters.priority
    const typeFilter = filters.type
    const sourceFilter = filters.source
    const assigneeFilter = filters.assignees
    const reviewerFilter = filters.reviewers
    const creatorFilter = filters.creators
    const searchLower = filters.search.toLowerCase()

    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.debug('[Unscheduled] raw items from BE:', items.length, items)
    }

    return items
      // Belt-and-braces: BE already filters with `hasDueDate=false`, but
      // re-assert here so an in-flight refetch / stale cache can't bleed
      // a just-scheduled ticket back into the panel (PM-58).
      .filter((i) => !i.dueDate)
      // Modules (DOMAIN) are organisational, not work items — never schedule them.
      .filter((i) => SCHEDULABLE_TYPES.has(i.type))
      .filter((i) => ACTIVE_STATUSES.has(i.status))
      .filter((i) => (statusFilter.size ? statusFilter.has(i.status) : true))
      .filter((i) => (priorityFilter.size ? priorityFilter.has(i.priority) : true))
      .filter((i) => (typeFilter.size ? typeFilter.has(i.type) : true))
      .filter((i) => (sourceFilter.size ? sourceFilter.has(i.source) : true))
      .filter((i) =>
        assigneeFilter.size
          ? !!i.assigneeId && assigneeFilter.has(i.assigneeId)
          : true,
      )
      .filter((i) =>
        reviewerFilter.size
          ? !!i.reviewerAssigneeId && reviewerFilter.has(i.reviewerAssigneeId)
          : true,
      )
      .filter((i) => (creatorFilter.size ? creatorFilter.has(i.creatorId) : true))
      .filter(
        (i) =>
          !searchLower ||
          i.title.toLowerCase().includes(searchLower) ||
          String(i.number).includes(filters.search),
      )
      .sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority] ?? 99
        const pb = PRIORITY_RANK[b.priority] ?? 99
        if (pa !== pb) return pa - pb
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
  }, [items, filters])

  return {
    items: filtered,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  }
}
