import { notificationApi, type Notification } from '@/features/notification/api'

export type { Notification } from '@/features/notification/api'

/**
 * Repository layer for in-app notifications. Wraps the HTTP client with
 * domain-named methods so the bell component reads like business intent.
 */
export const notificationRepository = {
  /** All notifications for the current user. */
  findMine(): Promise<Notification[]> {
    return notificationApi.list()
  },

  /** Count of unread notifications for the badge. */
  getUnreadCount(): Promise<number> {
    return notificationApi.unreadCount()
  },

  /** Mark a single notification as read. */
  markAsRead: notificationApi.markAsRead,

  /** Bulk-mark every notification as read. */
  markAllAsRead: notificationApi.markAllAsRead,
}

export type NotificationRepository = typeof notificationRepository
