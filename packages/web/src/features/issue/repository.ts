import { issueApi, uploadApi, type Attachment, type BoardQueryParams, type Issue, type PaginatedIssues } from '@/features/issue/api'

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

  /**
   * Low-level list with raw server params. Used by IssuesPage where the
   * URL → params transform already produces the server-shaped dict.
   */
  findInProjectRaw: issueApi.list,

  /**
   * Like findInProjectRaw but pages through every result. Used by the
   * grouped tree view so the hierarchy isn't truncated at the 200-row cap.
   */
  findAllInProjectRaw: issueApi.listAll,

  /** EPIC-type issues only — used by the parent picker in IssueDetailPanel. */
  findEpicsInProject(projectId: string): Promise<Issue[]> {
    return issueApi.list(projectId, { type: 'EPIC', limit: String(EPIC_PAGE_SIZE) }).then((r) => r.items)
  },

  /** Full board layout (status → issues). `sort` is the comma-separated
   *  `field:dir` form the FE filter-codec produces. */
  findBoardLayout(
    projectId: string,
    options: BoardQueryParams = {},
  ) {
    const params: BoardQueryParams = {}
    for (const [key, value] of Object.entries(options) as Array<[keyof BoardQueryParams, BoardQueryParams[keyof BoardQueryParams]]>) {
      if (value) params[key] = value as never
    }
    return issueApi.board(projectId, Object.keys(params).length ? params : undefined)
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
  /** PM↑ bulk-assign Module (DOMAIN parent) for a list of Epics. */
  bulkSetParent: issueApi.bulkSetParent,

  /** Project Domain → Epic outline (Table of Content view). */
  findTableOfContent: issueApi.tableOfContent,

  /** Activity feed. */
  findActivities: issueApi.activities,
  findProjectActivities: issueApi.projectActivities,

  /** Comments. */
  findComments: issueApi.comments,
  createComment: issueApi.createComment,
  updateComment: issueApi.updateComment,
  deleteComment: issueApi.deleteComment,

  /** Issue-to-issue links (BLOCKS, RELATES_TO, DUPLICATES, ...). */
  findLinks: issueApi.getLinks,
  createLink: issueApi.createLink,
  deleteLink: issueApi.deleteLink,

  /** Issue-to-spec section links. */
  createSpecLink: issueApi.createSpecLink,
  deleteSpecLink: issueApi.deleteSpecLink,

  /** File attachments (uploaded against an issueId or commentId). */
  uploadFile: uploadApi.upload,
  removeFile: uploadApi.delete,

  /**
   * Direct-to-S3 upload via presigned URL. Used by the rich-text editor
   * where large media (≥30 MB) would otherwise have to round-trip
   * through the API server. Returns the same Attachment shape as the
   * legacy multipart upload so callers stay interchangeable.
   *
   * `onProgress` fires while bytes are streaming to S3 (presign +
   * confirm phases are effectively instant). Throws on any failure;
   * the caller is responsible for cleaning up its in-editor placeholder.
   */
  async presignedUpload(
    file: File,
    opts: { issueId?: string; commentId?: string; onProgress?: (pct: number) => void } = {},
  ): Promise<Attachment> {
    const { url, key } = await uploadApi.presign({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
    await uploadApi.putToS3(url, file, opts.onProgress)
    return uploadApi.confirm({
      key,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      issueId: opts.issueId,
      commentId: opts.commentId,
    })
  },
}

export type IssueRepository = typeof issueRepository
