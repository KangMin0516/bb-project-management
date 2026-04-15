import api from './client'

export interface SlackStatus {
  connected: boolean
  integrationId?: string
  teamName?: string
}

export interface SlackChannel {
  id: string
  name: string
}

export const slackApi = {
  getInstallUrl: () =>
    api.get<{ data: { url: string } }>('/slack/install').then((r) => r.data.data),
  getStatus: () =>
    api.get<{ data: SlackStatus }>('/slack/status').then((r) => r.data.data),
  getChannels: (integrationId: string) =>
    api.get<{ data: { channels: SlackChannel[] } }>(`/slack/channels?integrationId=${integrationId}`).then((r) => r.data.data.channels),
  disconnect: (integrationId: string) =>
    api.delete(`/slack/disconnect?integrationId=${integrationId}`),
}
