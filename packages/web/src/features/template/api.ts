import api from '@/shared/api/client'

export interface IssueTemplate {
  id: string
  name: string
  type: string
  description: string | null
  createdAt: string
  updatedAt: string
  creator: { id: string; email: string; name: string; avatar: string | null }
}

export interface CreateTemplatePayload {
  name: string
  type: string
  description?: string
}

export interface UpdateTemplatePayload {
  name?: string
  type?: string
  description?: string
}

export const templateApi = {
  list: () =>
    api.get<{ data: IssueTemplate[] }>('/templates').then((r) => r.data.data),
  create: (data: CreateTemplatePayload) =>
    api.post<{ data: IssueTemplate }>('/templates', data).then((r) => r.data.data),
  update: (id: string, data: UpdateTemplatePayload) =>
    api.patch<{ data: IssueTemplate }>(`/templates/${id}`, data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/templates/${id}`),
}
