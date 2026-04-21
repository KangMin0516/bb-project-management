import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFICATION_LIMIT } from '../common/constants.js';

type NotificationType = 'ASSIGNED' | 'COMMENTED' | 'MENTIONED' | 'JOIN_APPROVED' | 'JOIN_REJECTED';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: NOTIFICATION_LIMIT,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }
    return result;
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async create(data: {
    type: NotificationType;
    message: string;
    userId: string;
    issueId?: string;
    projectId?: string;
    actorId?: string;
  }) {
    // Don't notify yourself
    if (data.actorId === data.userId) return null;

    return this.prisma.notification.create({ data });
  }
}
