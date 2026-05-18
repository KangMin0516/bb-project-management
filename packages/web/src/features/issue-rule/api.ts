import api from '@/shared/api/client'

export type IssueType = 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK'

export interface IssueRule {
  id: string
  issueType: IssueType
  titlePattern: string | null
  descriptionTemplate: string | null
  requiredFields: string[]
  defaultValues: Record<string, unknown>
  enforcedLabelNames: string[]
  createdAt: string
  updatedAt: string
}

export interface UpsertIssueRulePayload {
  issueType: IssueType
  titlePattern?: string | null
  descriptionTemplate?: string | null
  requiredFields?: string[]
  defaultValues?: Record<string, unknown>
  enforcedLabelNames?: string[]
}

export const issueRuleApi = {
  list: () =>
    api
      .get<{ data: IssueRule[] }>('/issue-rules')
      .then((r) => r.data.data),
  getOne: (issueType: IssueType) =>
    api
      .get<{ data: IssueRule | null }>(`/issue-rules/${issueType}`)
      .then((r) => r.data.data),
  upsert: (data: UpsertIssueRulePayload) =>
    api
      .put<{ data: IssueRule }>('/issue-rules', data)
      .then((r) => r.data.data),
  remove: (issueType: IssueType) =>
    api.delete(`/issue-rules/${issueType}`),
}
