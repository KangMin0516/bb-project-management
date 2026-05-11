import api from './client'

export type SpecStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'DEPRECATED'

export interface SpecUser {
  id: string
  email: string
  name: string
  avatar: string | null
}

export interface SpecSection {
  id: string
  sectionId: string
  level: number
  title: string
  order: number
}

export interface SpecComment {
  id: string
  content: string
  resolved: boolean
  createdAt: string
  updatedAt: string
  specId: string
  sectionId: string | null
  userId: string
  parentId: string | null
  user: SpecUser
  section: { id: string; sectionId: string; title: string } | null
  replies: SpecComment[]
}

export interface SpecListItem {
  id: string
  title: string
  category: string | null
  status: SpecStatus
  order: number
  createdAt: string
  updatedAt: string
  creator: SpecUser
  _count: { comments: number }
}

export interface SpecIssueLink {
  id: string
  sectionSlug: string
  issue: { id: string; number: number; title: string; status: string; priority: string }
}

export interface SpecDetail extends SpecListItem {
  content: string
  sections: SpecSection[]
  comments: SpecComment[]
  issueLinks?: SpecIssueLink[]
}

export const specApi = {
  list: (projectId: string, params?: { category?: string; status?: string }) =>
    api.get<{ data: SpecListItem[] }>(`/projects/${projectId}/specifications`, { params }).then((r) => r.data.data),

  get: (projectId: string, specId: string) =>
    api.get<{ data: SpecDetail }>(`/projects/${projectId}/specifications/${specId}`).then((r) => r.data.data),

  create: (projectId: string, data: { title: string; content: string; category?: string; status?: SpecStatus }) =>
    api.post<{ data: SpecDetail }>(`/projects/${projectId}/specifications`, data).then((r) => r.data.data),

  update: (
    projectId: string,
    specId: string,
    data: { title?: string; content?: string; category?: string; status?: SpecStatus; order?: number },
  ) =>
    api.patch<{ data: SpecDetail }>(`/projects/${projectId}/specifications/${specId}`, data).then((r) => r.data.data),

  delete: (projectId: string, specId: string) =>
    api.delete(`/projects/${projectId}/specifications/${specId}`),

  downloadOne: (projectId: string, specId: string) =>
    api.get<Blob>(`/projects/${projectId}/specifications/${specId}/download`, { responseType: 'blob' }).then((r) => r.data),

  downloadAll: (projectId: string) =>
    api.get<{ data: { filename: string; content: string; category: string | null; status: string; order: number }[] }>(
      `/projects/${projectId}/specifications/download/all`,
    ).then((r) => r.data.data),

  // Comments
  listComments: (projectId: string, specId: string, sectionId?: string) =>
    api.get<{ data: SpecComment[] }>(`/projects/${projectId}/specifications/${specId}/comments`, {
      params: sectionId ? { sectionId } : undefined,
    }).then((r) => r.data.data),

  createComment: (projectId: string, specId: string, data: { content: string; sectionId?: string; parentId?: string }) =>
    api.post<{ data: SpecComment }>(`/projects/${projectId}/specifications/${specId}/comments`, data).then((r) => r.data.data),

  updateComment: (projectId: string, specId: string, commentId: string, data: { content?: string; resolved?: boolean }) =>
    api.patch<{ data: SpecComment }>(`/projects/${projectId}/specifications/${specId}/comments/${commentId}`, data).then((r) => r.data.data),

  deleteComment: (projectId: string, specId: string, commentId: string) =>
    api.delete(`/projects/${projectId}/specifications/${specId}/comments/${commentId}`),
}
