import { issueApi, type Issue, type PaginatedIssues } from '@/features/issue/api'

/**
 * Repository layer for Issue. Wraps the raw HTTP client with typed,
 * domain-named methods so call sites read like business intent
 * (`issueRepository.findEpicsInProject(p)`) rather than infrastructure
 * (`issueApi.list(p, { type: 'EPIC', limit: '200' })`).
 *
 * Per the BPM spec: "wrap API call thành object methods
 * (taskRepository.findMine()) thay vì gọi axios trực tiếp."
 */

const DEFAULT_PAGE_SIZE = 50
const EPIC_PAGE_SIZE = 200

/**
 * Strongly-typed filter input — server expects flat string params so we
 * shape that conversion in one place. Multi-select fields fall back to
 * client-side filtering (see useIssueListData).
 */
export interface IssueListFilters {
  search?: string
  status?: string
  priority?: string
  type?: string
  assigneeId?: string
  includeArchived?: boolean
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

function toQueryParams(filters: IssueListFilters): Record<string, string> {
  const params: Record<string, string> = { limit: String(filters.limit ?? DEFAULT_PAGE_SIZE) }
  if (filters.search) params.search = filters.search
  if (filters.status) params.status = filters.status
  if (filters.priority) params.priority = filters.priority
  if (filters.type) params.type = filters.type
  if (filters.assigneeId) params.assigneeId = filters.assigneeId
  if (filters.includeArchived) params.includeArchived = 'true'
  if (filters.sortBy) {
    params.sortBy = filters.sortBy
    params.sortOrder = filters.sortOrder ?? 'desc'
  }
  return params
}

export const issueRepository = {
  /** All issues in a project matching the given filters. */
  findInProject(projectId: string, filters: IssueListFilters = {}): Promise<PaginatedIssues> {
    return issueApi.list(projectId, toQueryParams(filters))
  },

  /** EPIC-type issues only — used by the parent picker in IssueDetailPanel. */
  findEpicsInProject(projectId: string): Promise<Issue[]> {
    return issueApi.list(projectId, { type: 'EPIC', limit: String(EPIC_PAGE_SIZE) }).then((r) => r.items)
  },

  /** Full board layout (status → issues), optionally including archived. */
  findBoardLayout(projectId: string, includeArchived = false) {
    return issueApi.board(projectId, includeArchived ? { includeArchived: true } : undefined)
  },

  /** BLOCKS-relationship graph for the dependency view. */
  findDependencyGraph(projectId: string) {
    return issueApi.dependencies(projectId)
  },

  /** One issue with all nested resources (activities, attachments, links). */
  findOne(projectId: string, issueId: string) {
    return issueApi.get(projectId, issueId)
  },

  /** Lifecycle. */
  create: issueApi.create,
  update: issueApi.update,
  remove: issueApi.delete,

  /** Re-order across columns or within a column. */
  reorder: issueApi.reorder,

  /** Bulk operations from the issues list page. */
  bulkUpdate: issueApi.bulkUpdate,
  bulkDelete: issueApi.bulkDelete,
}

export type IssueRepository = typeof issueRepository
