import api from './client'

export interface StandupQuestion {
  id: string
  text: string
  ignoreText: string
  order: number
}

export interface StandupConfigMember {
  configId: string
  slackUserId: string
  username: string | null
  isAway: boolean
}

export interface StandupConfigQuestion {
  configId: string
  questionId: string
  order: number
  question: StandupQuestion
}

export interface StandupConfig {
  id: string
  name: string
  greeting: string
  goodbye: string
  channelId: string
  channelName: string | null
  cronHour: string
  cronMinute: string
  cronDayOfWeek: string
  timezone: string
  enabled: boolean
  slackIntegrationId: string
  lastTriggeredAt: string | null
  questions: StandupConfigQuestion[]
  members: StandupConfigMember[]
  _count: { reports: number }
}

export interface StandupReport {
  id: string
  status: string
  slackUserId: string
  username: string | null
  configId: string
  createdAt: string
  answers: Array<{
    id: string
    answer: string | null
    order: number
    question: StandupQuestion
  }>
}

export const standupApi = {
  // Questions
  listQuestions: () =>
    api.get<{ data: StandupQuestion[] }>('/standup/questions').then((r) => r.data.data),
  createQuestion: (data: { text: string; ignoreText?: string; order?: number }) =>
    api.post<{ data: StandupQuestion }>('/standup/questions', data).then((r) => r.data.data),
  updateQuestion: (id: string, data: Partial<{ text: string; ignoreText: string; order: number }>) =>
    api.patch<{ data: StandupQuestion }>(`/standup/questions/${id}`, data).then((r) => r.data.data),
  deleteQuestion: (id: string) =>
    api.delete(`/standup/questions/${id}`),

  // Configs
  listConfigs: () =>
    api.get<{ data: StandupConfig[] }>('/standup/configs').then((r) => r.data.data),
  createConfig: (data: Record<string, unknown>) =>
    api.post<{ data: StandupConfig }>('/standup/configs', data).then((r) => r.data.data),
  updateConfig: (id: string, data: Record<string, unknown>) =>
    api.patch<{ data: StandupConfig }>(`/standup/configs/${id}`, data).then((r) => r.data.data),
  deleteConfig: (id: string) =>
    api.delete(`/standup/configs/${id}`),
  triggerConfig: (id: string) =>
    api.post(`/standup/configs/${id}/trigger`),
  getReports: (id: string, limit = 50) =>
    api.get<{ data: StandupReport[] }>(`/standup/configs/${id}/reports?limit=${limit}`).then((r) => r.data.data),
}
