import api from '@/shared/api/client'

export interface CredentialEntry {
  key: string
  value: string
  sensitive: boolean
}

export interface Credential {
  id: string
  name: string
  serviceType: string
  description: string | null
  url: string | null
  entries: CredentialEntry[]
  createdBy: { id: string; name: string }
  createdAt: string
  updatedAt: string
}

export interface CreateCredentialPayload {
  name: string
  serviceType: string
  description?: string
  url?: string
  entries: CredentialEntry[]
}

export const credentialApi = {
  list: (projectId: string) =>
    api.get<{ data: Credential[] }>(`/projects/${projectId}/credentials`).then((r) => r.data.data),
  get: (projectId: string, id: string) =>
    api.get<{ data: Credential }>(`/projects/${projectId}/credentials/${id}`).then((r) => r.data.data),
  reveal: (projectId: string, id: string) =>
    api.get<{ data: Credential }>(`/projects/${projectId}/credentials/${id}/reveal`).then((r) => r.data.data),
  create: (projectId: string, data: CreateCredentialPayload) =>
    api.post<{ data: Credential }>(`/projects/${projectId}/credentials`, data).then((r) => r.data.data),
  update: (projectId: string, id: string, data: Partial<CreateCredentialPayload>) =>
    api.patch<{ data: Credential }>(`/projects/${projectId}/credentials/${id}`, data).then((r) => r.data.data),
  remove: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/credentials/${id}`),
}
