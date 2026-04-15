import api from './client'

export interface DailyReportConfig {
  id: string
  enabled: boolean
  timezone: string
  morningTime: string
  morningChannelId: string | null
  morningChannelName: string | null
  lunchTime: string
  lunchChannelId: string | null
  lunchChannelName: string | null
  eveningTime: string
  eveningChannelId: string | null
  eveningChannelName: string | null
  skipWeekends: boolean
  slackIntegrationId: string
}

export type UpdateReportConfigPayload = Partial<Omit<DailyReportConfig, 'id'>>

export const reportApi = {
  getConfig: (projectId: string) =>
    api.get<{ data: DailyReportConfig | null }>(`/projects/${projectId}/report-config`).then((r) => r.data.data),
  updateConfig: (projectId: string, data: UpdateReportConfigPayload) =>
    api.put<{ data: DailyReportConfig }>(`/projects/${projectId}/report-config`, data).then((r) => r.data.data),
  testSend: (projectId: string, type: 'morning' | 'lunch' | 'evening') =>
    api.post(`/projects/${projectId}/report-config/test/${type}`),
}
