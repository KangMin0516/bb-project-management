import api from '@/shared/api/client'

export interface ApiKeySummary {
  id: string
  name: string
  lastUsed: string | null
  createdAt: string
}

/** Returned only when a key is first created — the raw `key` is never re-fetched. */
export interface ApiKeyWithSecret {
  id: string
  name: string
  /** Raw secret (`bbpm_<56 hex>`). Show once, never persist. */
  key: string
  createdAt: string
}

export const apiKeyApi = {
  list: () =>
    api.get<{ data: ApiKeySummary[] }>('/api-keys').then((r) => r.data.data),
  create: (name: string) =>
    api
      .post<{ data: ApiKeyWithSecret }>('/api-keys', { name })
      .then((r) => r.data.data),
  remove: (id: string) =>
    api.delete<{ data: { deleted: true } }>(`/api-keys/${id}`).then((r) => r.data.data),
}
