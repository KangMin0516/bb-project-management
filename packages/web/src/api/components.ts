import api from './client'

export interface Component {
  id: string
  name: string
  description: string | null
  leadId: string | null
  defaultAssigneeId: string | null
  lead: { id: string; name: string; avatar: string | null } | null
  defaultAssignee: { id: string; name: string; avatar: string | null } | null
  _count: { issues: number }
}

export interface CreateComponentPayload {
  name: string
  description?: string
  leadId?: string
  defaultAssigneeId?: string
}

export interface UpdateComponentPayload {
  name?: string
  description?: string
  leadId?: string | null
  defaultAssigneeId?: string | null
}

export const componentApi = {
  list: (projectId: string) =>
    api.get<{ data: Component[] }>(`/projects/${projectId}/components`).then((r) => r.data.data),
  get: (projectId: string, componentId: string) =>
    api.get<{ data: Component }>(`/projects/${projectId}/components/${componentId}`).then((r) => r.data.data),
  create: (projectId: string, data: CreateComponentPayload) =>
    api.post<{ data: Component }>(`/projects/${projectId}/components`, data).then((r) => r.data.data),
  update: (projectId: string, componentId: string, data: UpdateComponentPayload) =>
    api.patch<{ data: Component }>(`/projects/${projectId}/components/${componentId}`, data).then((r) => r.data.data),
  delete: (projectId: string, componentId: string) =>
    api.delete(`/projects/${projectId}/components/${componentId}`),
}
