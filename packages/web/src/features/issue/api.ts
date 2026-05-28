import api from '@/shared/api/client'
import type { GitHubPrLink } from '@/features/integrations/github/api'

export type IssueSource = 'WEB' | 'MCP' | 'SLACK' | 'WEBHOOK' | 'API' | 'SYSTEM'

export interface Issue {
  id: string
  number: number
  title: string
  description: string | null
  status: string
  priority: string
  type: string
  order: number
  isRecheck: boolean
  startDate: string | null
  dueDate: string | null
  focusDate: string | null
  archivedAt: string | null
  /** Client that originally created this issue. Drives the "via MCP" badge in UI. */
  source: IssueSource
  createdAt: string
  updatedAt: string
  projectId: string
  assigneeId: string | null
  reviewerAssigneeId: string | null
  creatorId: string
  parentId: string | null
  assignee: { id: string; email: string; name: string; avatar: string | null } | null
  reviewerAssignee: { id: string; email: string; name: string; avatar: string | null } | null
  creator: { id: string; email: string; name: string; avatar: string | null } | null
  labels: { label: { id: string; name: string; color: string } }[]
  components: { component: { id: string; name: string } }[]
  parent: { id: string; number: number; title: string; type: string } | null
  _count: { children: number }
  /** Aggregate done/total of DIRECT children, populated by the Board
   *  endpoint. Counts archived children too, so progress strips on
   *  collapsed cards stay accurate after the auto-archive scheduler
   *  ages DONE rows out of the per-status payload. */
  progress?: { total: number; done: number }
}

export type IssueLinkType = 'BLOCKS' | 'IS_BLOCKED_BY' | 'RELATES_TO' | 'DUPLICATES' | 'IS_DUPLICATED_BY'

export interface LinkedIssueInfo {
  id: string
  number: number
  title: string
  status: string
  priority: string
  type: string
  project: { key: string }
}

export interface IssueLink {
  id: string
  type: IssueLinkType
  createdAt: string
  targetIssue?: LinkedIssueInfo
  sourceIssue?: LinkedIssueInfo
  creator: { id: string; name: string } | null
}

export interface IssueSpecLink {
  id: string
  sectionSlug: string
  createdAt: string
  spec: { id: string; title: string; status: string; category: string | null }
}

export interface IssueDetail extends Omit<Issue, 'parent'> {
  parent: {
    id: string; number: number; title: string; type: string
    parent: { id: string; number: number; title: string; type: string } | null
  } | null
  children: {
    id: string; number: number; title: string; status: string; priority: string
    assignee: { id: string; email: string; name: string; avatar: string | null } | null
  }[]
  activities: Activity[]
  attachments: Attachment[]
  sourceLinks?: IssueLink[]
  targetLinks?: IssueLink[]
  specLinks?: IssueSpecLink[]
  githubPrLinks?: GitHubPrLink[]
}

export interface Activity {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
  source: IssueSource
  user: { id: string; email: string; name: string; avatar: string | null }
  issue?: { id: string; number: number; title: string }
}

export interface Attachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
  createdAt: string
}

export interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  source: IssueSource
  user: { id: string; email: string; name: string; avatar: string | null }
  attachments?: Attachment[]
}

export interface PaginatedIssues {
  items: Issue[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateIssuePayload {
  title: string
  description?: string
  status?: string
  priority?: string
  type?: string
  assigneeId?: string
  /** Omit to default to creator. Pass `null` to opt out (no reviewer). */
  reviewerAssigneeId?: string | null
  parentId?: string
  startDate?: string
  dueDate?: string
  labelIds?: string[]
  componentIds?: string[]
  mentionedUserIds?: string[]
}

export interface UpdateIssuePayload {
  title?: string
  description?: string
  status?: string
  priority?: string
  type?: string
  assigneeId?: string | null
  reviewerAssigneeId?: string | null
  parentId?: string | null
  startDate?: string | null
  dueDate?: string | null
  focusDate?: string | null
  order?: number
  isRecheck?: boolean
  labelIds?: string[]
  componentIds?: string[]
  mentionedUserIds?: string[]
}

export interface DependencyLink {
  id: string
  type: 'BLOCKS'
  createdAt: string
  sourceIssue: LinkedIssueInfo
  targetIssue: LinkedIssueInfo
}

/**
 * Shape returned by `GET /projects/:projectId/issues/table-of-content`.
 * `orphanEpics` is the bucket for Epics that haven't been assigned a
 * Module yet — backward-compat for projects created before the feature.
 */
export interface TableOfContentEpic {
  id: string
  title: string
  status: string
  taskCount: number
  doneCount: number
}

export interface TableOfContentDomain {
  id: string
  title: string
  epics: TableOfContentEpic[]
}

export interface TableOfContent {
  domains: TableOfContentDomain[]
  orphanEpics: TableOfContentEpic[]
}

export const issueApi = {
  list: (projectId: string, params?: Record<string, string>) =>
    api.get<{ data: PaginatedIssues }>(`/projects/${projectId}/issues`, { params }).then((r) => r.data.data),
  board: (projectId: string, params?: { includeArchived?: boolean; sort?: string }) =>
    api.get<{ data: Record<string, Issue[]> }>(`/projects/${projectId}/issues/board`, { params }).then((r) => r.data.data),
  dependencies: (projectId: string) =>
    api.get<{ data: DependencyLink[] }>(`/projects/${projectId}/issues/dependencies`).then((r) => r.data.data),
  get: (projectId: string, issueId: string) =>
    api.get<{ data: IssueDetail }>(`/projects/${projectId}/issues/${issueId}`).then((r) => r.data.data),
  create: (projectId: string, data: CreateIssuePayload) =>
    api.post<{ data: Issue }>(`/projects/${projectId}/issues`, data).then((r) => r.data.data),
  update: (projectId: string, issueId: string, data: UpdateIssuePayload) =>
    api.patch<{ data: Issue }>(`/projects/${projectId}/issues/${issueId}`, data).then((r) => r.data.data),
  reorder: (projectId: string, issueId: string, data: { status: string; order: number }) =>
    api.patch<{ data: Issue }>(`/projects/${projectId}/issues/${issueId}/reorder`, data).then((r) => r.data.data),
  delete: (projectId: string, issueId: string) =>
    api.delete(`/projects/${projectId}/issues/${issueId}`),
  bulkUpdate: (projectId: string, data: { issueIds: string[]; status?: string; priority?: string; assigneeId?: string | null }) =>
    api.patch<{ data: { updated: number } }>(`/projects/${projectId}/issues/bulk`, data).then((r) => r.data.data),
  bulkDelete: (projectId: string, issueIds: string[]) =>
    api.post<{ data: { deleted: number } }>(`/projects/${projectId}/issues/bulk-delete`, { issueIds }).then((r) => r.data.data),
  /** Bulk-assign Module (DOMAIN parent) to a list of Epics. `parentId=null` unparents. PM↑ only. */
  bulkSetParent: (projectId: string, issueIds: string[], parentId: string | null) =>
    api.patch<{ data: { updated: number } }>(`/projects/${projectId}/issues/bulk-set-parent`, { issueIds, parentId }).then((r) => r.data.data),
  /** Project's Domain → Epic outline + orphan Epics bucket. */
  tableOfContent: (projectId: string) =>
    api.get<{ data: TableOfContent }>(`/projects/${projectId}/issues/table-of-content`).then((r) => r.data.data),

  activities: (projectId: string, issueId: string) =>
    api.get<{ data: { items: Activity[]; total: number } }>(`/projects/${projectId}/issues/${issueId}/activities`).then((r) => r.data.data),
  projectActivities: (projectId: string) =>
    api.get<{ data: { items: Activity[]; total: number } }>(`/projects/${projectId}/activities`).then((r) => r.data.data),

  comments: (projectId: string, issueId: string) =>
    api.get<{ data: { items: Comment[]; total: number } }>(`/projects/${projectId}/issues/${issueId}/comments`).then((r) => r.data.data),
  createComment: (projectId: string, issueId: string, data: { content: string; mentionedUserIds?: string[] }) =>
    api.post<{ data: Comment }>(`/projects/${projectId}/issues/${issueId}/comments`, data).then((r) => r.data.data),
  updateComment: (projectId: string, issueId: string, commentId: string, data: { content: string }) =>
    api.patch<{ data: Comment }>(`/projects/${projectId}/issues/${issueId}/comments/${commentId}`, data).then((r) => r.data.data),
  deleteComment: (projectId: string, issueId: string, commentId: string) =>
    api.delete(`/projects/${projectId}/issues/${issueId}/comments/${commentId}`),

  getLinks: (projectId: string, issueId: string) =>
    api.get<{ data: { sourceLinks: IssueLink[]; targetLinks: IssueLink[] } }>(`/projects/${projectId}/issues/${issueId}/links`).then((r) => r.data.data),
  createLink: (projectId: string, issueId: string, data: { targetIssueId: string; type: IssueLinkType }) =>
    api.post<{ data: IssueLink }>(`/projects/${projectId}/issues/${issueId}/links`, data).then((r) => r.data.data),
  deleteLink: (projectId: string, issueId: string, linkId: string) =>
    api.delete(`/projects/${projectId}/issues/${issueId}/links/${linkId}`),

  createSpecLink: (projectId: string, issueId: string, data: { specId: string; sectionSlug?: string }) =>
    api.post<{ data: IssueSpecLink }>(`/projects/${projectId}/issues/${issueId}/spec-links`, data).then((r) => r.data.data),
  deleteSpecLink: (projectId: string, issueId: string, linkId: string) =>
    api.delete(`/projects/${projectId}/issues/${issueId}/spec-links/${linkId}`),
}

export interface PresignResult {
  /** Storage key, must be passed back to /upload/confirm. */
  key: string
  /** Presigned URL the browser PUTs the bytes to. */
  url: string
  /** Public URL the Attachment row will end up with. */
  publicUrl: string
}

export const uploadApi = {
  /**
   * Multipart upload through the API server. Used everywhere by default
   * (editor + side-panel attachment list) — direct-to-S3 presigned PUT
   * exists in `presign`/`putToS3`/`confirm` below but requires bucket
   * CORS to be configured, so the editor stays on multipart until ops
   * unlocks it. `onProgress` reports bytes uploaded to the API server
   * (the API→S3 leg is invisible to us — close enough for UX).
   */
  upload: (
    file: File,
    opts?: { issueId?: string; commentId?: string; onProgress?: (pct: number) => void },
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    if (opts?.issueId) params.set('issueId', opts.issueId)
    if (opts?.commentId) params.set('commentId', opts.commentId)
    return api.post<{ data: Attachment }>(`/upload?${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: opts?.onProgress
        ? (e) => {
            if (e.total) opts.onProgress!(Math.round((e.loaded / e.total) * 100))
          }
        : undefined,
    }).then((r) => r.data.data)
  },

  /** Ask the API to mint a presigned PUT URL for direct browser→S3 upload. */
  presign: (input: { fileName: string; fileSize: number; mimeType: string }) =>
    api.post<{ data: PresignResult }>(`/upload/presign`, input).then((r) => r.data.data),

  /**
   * PUT the file bytes straight to S3. Uses XMLHttpRequest so we can
   * surface upload progress to the user — axios doesn't expose progress
   * on cross-origin no-credentials requests reliably across browsers.
   */
  putToS3: (presignedUrl: string, file: File, onProgress?: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presignedUrl, true)
      xhr.setRequestHeader('Content-Type', file.type)
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        })
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`))
      }
      xhr.onerror = () => reject(new Error('S3 upload network error'))
      xhr.onabort = () => reject(new Error('S3 upload aborted'))
      xhr.send(file)
    }),

  /** Finalise the presigned-PUT flow — creates the Attachment row. */
  confirm: (input: {
    key: string
    fileName: string
    fileSize: number
    mimeType: string
    issueId?: string
    commentId?: string
  }) => api.post<{ data: Attachment }>(`/upload/confirm`, input).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete(`/upload/${id}`),
}
