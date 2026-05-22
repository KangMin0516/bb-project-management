import api from '@/shared/api/client'

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

export type GlobalSearchKind = 'issue' | 'comment' | 'spec'

export interface GlobalSearchResult {
  kind: GlobalSearchKind
  /** UUID of the matched row. */
  id: string
  projectId: string
  projectKey: string
  /** Issue / spec title, or parent issue title for comments. */
  title: string
  snippet: string
  score: number
  /** Only set for `issue` / `comment` kinds. */
  issueNumber?: number
}

export const searchApi = {
  issues: (q: string) =>
    api.get<{ data: SearchResult[] }>('/search/issues', { params: { q } }).then((r) => r.data.data),
  /** Global cross-project search (PM-80) — issues + comments + specs. */
  all: (q: string) =>
    api.get<{ data: GlobalSearchResult[] }>('/search', { params: { q } }).then((r) => r.data.data),
}
