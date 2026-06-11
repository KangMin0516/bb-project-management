import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from '@/features/issue/components/board/types'

export interface BoardFilterState {
  assignees: Set<string>
  reviewers: Set<string>
  creators: Set<string>
  labels: Set<string>
  components: Set<string>
  epicId: string | null
  search: string
  status: Set<string>
  priority: Set<string>
  type: Set<string>
  source: Set<string>
}

interface FilterOptions {
  /** When true, EPIC rows pass the filter regardless of other criteria. */
  keepEpics?: boolean
  /** Issue's sub-tasks; if any sub-task is assigned to a selected assignee, the parent matches. */
  childrenMap?: Map<string, ChildIssue[]>
  /** Project key (e.g. "PITB") so search matches the full issue key, not just the bare number. */
  projectKey?: string
}

/**
 * Predicate that decides whether a single issue should appear under the
 * current filter state. EPIC pass-through is opt-in via `keepEpics` so
 * swimlane mode can keep epics visible even when their children don't
 * match all criteria.
 */
export function matchesFilters(issue: Issue, filters: BoardFilterState, options?: FilterOptions): boolean {
  if (options?.keepEpics && issue.type === 'EPIC') return true

  const { assignees, reviewers, creators, labels, components, epicId, search, status, priority, type, source } = filters
  const searchLower = search.trim().toLowerCase()
  // PM-110: accept the full issue key too ("PITB-1065"), not only the bare
  // number ("1065"). Strip a leading `<projectKey>-` before the number test.
  const keyPrefix = options?.projectKey ? `${options.projectKey.toLowerCase()}-` : ''
  const numberPart = keyPrefix && searchLower.startsWith(keyPrefix) ? searchLower.slice(keyPrefix.length) : searchLower
  const searchMatch =
    !searchLower ||
    issue.title.toLowerCase().includes(searchLower) ||
    String(issue.number).includes(numberPart) ||
    (!!keyPrefix && `${keyPrefix}${issue.number}`.includes(searchLower))

  let assigneeMatch = assignees.size === 0 || (!!issue.assigneeId && assignees.has(issue.assigneeId))
  if (!assigneeMatch && assignees.size > 0 && options?.childrenMap) {
    const children = options.childrenMap.get(issue.id)
    if (children) {
      assigneeMatch = children.some((c) => c.assignee && assignees.has(c.assignee.id))
    }
  }

  return (
    assigneeMatch &&
    (reviewers.size === 0 || (!!issue.reviewerAssigneeId && reviewers.has(issue.reviewerAssigneeId))) &&
    (creators.size === 0 || creators.has(issue.creatorId)) &&
    (labels.size === 0 || issue.labels.some((il) => labels.has(il.label.id))) &&
    (components.size === 0 || issue.components?.some((ic) => components.has(ic.component.id))) &&
    (!epicId || issue.id === epicId || issue.parentId === epicId) &&
    searchMatch &&
    (issue.status !== 'CANCELED' || status.has('CANCELED')) &&
    (status.size === 0 || status.has(issue.status)) &&
    (priority.size === 0 || priority.has(issue.priority)) &&
    (type.size === 0 || type.has(issue.type)) &&
    (source.size === 0 || source.has(issue.source))
  )
}

/**
 * Apply `matchesFilters` to every column. Empty columns are dropped so
 * the layout doesn't render placeholder gaps for filtered-out statuses.
 */
export function filterBoard(
  source: Record<string, Issue[]> | undefined,
  filters: BoardFilterState,
  options?: FilterOptions,
): Record<string, Issue[]> {
  if (!source) return {}
  const filtered: Record<string, Issue[]> = {}
  for (const [status, issues] of Object.entries(source)) {
    const matching = issues.filter((issue) => matchesFilters(issue, filters, options))
    if (matching.length > 0) filtered[status] = matching
  }
  return filtered
}
