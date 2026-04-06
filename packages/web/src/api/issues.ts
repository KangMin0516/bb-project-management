import api from './client'

export interface Issue {
  id: string
  number: number
  title: string
  description: string | null
  status: string
  priority: string
  type: string
  order: number
  createdAt: string
  updatedAt: string
  projectId: string
  assigneeId: string | null
  creatorId: string
  parentId: string | null
  assignee: { id: string; email: string; name: string; avatar: string | null } | null
  creator: { id: string; email: string; name: string; avatar: string | null } | null
  labels: { label: { id: string; name: string; color: string } }[]
  parent: { id: string; number: number; title: string } | null
  _count: { children: number }
}

export interface IssueDetail extends Issue {
  children: {
    id: string; number: number; title: string; status: string; priority: string
    assignee: { id: string; email: string; name: string; avatar: string | null } | null
  }[]
  activities: Activity[]
}

export interface Activity {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user: { id: string; email: string; name: string; avatar: string | null }
  issue?: { id: string; number: number; title: string }
}

export interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string; avatar: string | null }
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
  parentId?: string
  labelIds?: string[]
}

export interface UpdateIssuePayload {
  title?: string
  description?: string
  status?: string
  priority?: string
  type?: string
  assigneeId?: string | null
  parentId?: string | null
  order?: number
  labelIds?: string[]
}

export const issueApi = {
  list: (projectId: string, params?: Record<string, string>) =>
    api.get<{ data: PaginatedIssues }>(`/projects/${projectId}/issues`, { params }).then((r) => r.data.data),
  board: (projectId: string) =>
    api.get<{ data: Record<string, Issue[]> }>(`/projects/${projectId}/issues/board`).then((r) => r.data.data),
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

  // Activities
  activities: (projectId: string, issueId: string) =>
    api.get<{ data: { items: Activity[]; total: number } }>(`/projects/${projectId}/issues/${issueId}/activities`).then((r) => r.data.data),
  projectActivities: (projectId: string) =>
    api.get<{ data: { items: Activity[]; total: number } }>(`/projects/${projectId}/activities`).then((r) => r.data.data),

  // Comments
  comments: (projectId: string, issueId: string) =>
    api.get<{ data: { items: Comment[]; total: number } }>(`/projects/${projectId}/issues/${issueId}/comments`).then((r) => r.data.data),
  createComment: (projectId: string, issueId: string, data: { content: string }) =>
    api.post<{ data: Comment }>(`/projects/${projectId}/issues/${issueId}/comments`, data).then((r) => r.data.data),
  updateComment: (projectId: string, issueId: string, commentId: string, data: { content: string }) =>
    api.patch<{ data: Comment }>(`/projects/${projectId}/issues/${issueId}/comments/${commentId}`, data).then((r) => r.data.data),
  deleteComment: (projectId: string, issueId: string, commentId: string) =>
    api.delete(`/projects/${projectId}/issues/${issueId}/comments/${commentId}`),
}
