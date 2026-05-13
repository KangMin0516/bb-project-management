import api from '@/shared/api/client'

export interface GitHubStatus {
  connected: boolean
  integrationId?: string
  ownerLogin?: string
  repoName?: string
  webhookUrl?: string
  webhookSecret?: string
  onPrOpenStatus?: string
  onPrMergeStatus?: string
  autoLinkEnabled?: boolean
}

export interface GitHubPullRequest {
  id: string
  number: number
  title: string
  url: string
  state: 'open' | 'closed' | 'merged'
  authorLogin: string
  authorAvatar?: string
  repoFullName: string
  baseBranch: string
  headBranch: string
  mergedAt?: string
  createdAt: string
}

export interface GitHubPrLink {
  id: string
  pullRequest: GitHubPullRequest
  createdAt: string
}

export interface GitHubRepo {
  fullName: string
  url: string
  isPrivate: boolean
}

export const githubApi = {
  connect: (projectId: string, data: { accessToken: string }) =>
    api.post<{ data: GitHubStatus }>(`/github/connect`, { ...data, projectId }).then((r) => r.data.data),
  getStatus: (projectId: string) =>
    api.get<{ data: GitHubStatus }>(`/github/status/${projectId}`).then((r) => r.data.data),
  updateConfig: (projectId: string, data: Partial<Pick<GitHubStatus, 'onPrOpenStatus' | 'onPrMergeStatus' | 'autoLinkEnabled'>>) =>
    api.patch<{ data: GitHubStatus }>(`/github/config/${projectId}`, data).then((r) => r.data.data),
  disconnect: (projectId: string) =>
    api.delete(`/github/disconnect/${projectId}`),
  getRepos: (projectId: string) =>
    api.get<{ data: { repos: GitHubRepo[] } }>(`/github/repos/${projectId}`).then((r) => r.data.data.repos),
  linkPr: (data: { projectId: string; issueId: string; prUrl: string }) =>
    api.post<{ data: GitHubPrLink }>(`/github/link-pr`, data).then((r) => r.data.data),
  unlinkPr: (linkId: string) =>
    api.delete(`/github/unlink-pr/${linkId}`),
}
