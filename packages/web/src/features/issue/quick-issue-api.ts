import api from '@/shared/api/client'

export interface ParsedIssue {
  projectId: string
  projectKey: string
  projectName: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  assigneeId?: string
  assigneeName?: string
}

export interface ParseResult {
  parsed?: ParsedIssue
  needsProjectSelection: boolean
  projectCandidates?: { id: string; key: string; name: string }[]
}

export interface CreateResult {
  issue: { id: string; number: number }
  issueKey: string
}

export const quickIssueApi = {
  parse: async (text: string, projectId?: string) => {
    const res = await api.post<ParseResult>('/quick-issue/parse', { text, projectId })
    return res.data
  },
  create: async (data: {
    projectId: string
    title: string
    description?: string
    type?: string
    priority?: string
    status?: string
    assigneeId?: string
  }) => {
    const res = await api.post<CreateResult>('/quick-issue/create', data)
    return res.data
  },
}
