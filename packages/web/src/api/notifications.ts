import api from './client'

export interface Notification {
  id: string
  type: string
  message: string
  isRead: boolean
  issueId: string | null
  projectId: string | null
  actorId: string | null
  createdAt: string
}

export const notificationApi = {
  list: () =>
    api.get<{ data: Notification[] }>('/notifications').then((r) => r.data.data),
  unreadCount: () =>
    api.get<{ data: number }>('/notifications/unread-count').then((r) => r.data.data),
  markAsRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),
  markAllAsRead: () =>
    api.patch('/notifications/read-all'),
}
