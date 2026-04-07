import api from './client'

export interface SearchResult {
  id: string
  number: number
  title: string
  status: string
  priority: string
  type: string
  assignee: { id: string; email: string; name: string; avatar: string | null } | null
  project: { id: string; key: string; name: string }
}

export const searchApi = {
  issues: (q: string) =>
    api.get<{ data: SearchResult[] }>('/search/issues', { params: { q } }).then((r) => r.data.data),
}
