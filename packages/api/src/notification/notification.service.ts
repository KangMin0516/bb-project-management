import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlackService } from '../slack/slack.service.js';
import { NOTIFICATION_LIMIT } from '../common/constants.js';

type NotificationType =
  | 'ASSIGNED'
  | 'COMMENTED'
  | 'MENTIONED'
  | 'JOIN_APPROVED'
  | 'JOIN_REJECTED';

export interface CreateNotificationInput {
  type: NotificationType;
  message: string;
  userId: string;
  issueId?: string;
  projectId?: string;
  actorId?: string;
  /**
   * Optional metadata for richer downstream delivery (Slack DM blocks, email).
   * The in-app notification row only stores `type` + `message` — meta is
   * consumed by the side-effect dispatchers below.
   */
  meta?: {
    projectKey?: string;
    issueNumber?: number;
    issueTitle?: string;
    actorName?: string;
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
    private config: ConfigService,
  ) {}

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

  async create(data: CreateNotificationInput) {
    // Don't notify yourself
    if (data.actorId === data.userId) return null;

    const { meta, ...persist } = data;
    void meta; // consumed by delivery side-effects below, not by the DB row
    const notification = await this.prisma.notification.create({
      data: persist,
    });

    // Fire-and-forget Slack DM for assignment events. Failures are logged
    // but never bubble up — the in-app notification is authoritative.
    if (data.type === 'ASSIGNED') {
      this.deliverSlackAssignedDm(data).catch((err) =>
        this.logger.warn(
          'Slack assignment DM failed',
          err instanceof Error ? err.message : String(err),
        ),
      );
    }

    return notification;
  }

  // ─── Slack delivery (best-effort) ──────────────────────────

  private async deliverSlackAssignedDm(data: CreateNotificationInput) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { slackUserId: true },
    });
    if (!recipient?.slackUserId) return; // user hasn't linked Slack

    const meta = data.meta ?? {};
    const projectKey = meta.projectKey ?? '';
    const issueNumber = meta.issueNumber;
    const issueTitle = meta.issueTitle ?? '';
    const actorName = meta.actorName ?? 'Someone';
    const issueKey = issueNumber != null ? `${projectKey}-${issueNumber}` : '';

    const fallbackText =
      issueKey && issueTitle
        ? `You've been assigned ${issueKey} "${issueTitle}" by ${actorName}`
        : data.message;

    const blocks: unknown[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:clipboard: *You've been assigned a new issue*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: issueKey
              ? `*${issueKey}*\n${escapeSlack(issueTitle)}`
              : `*${escapeSlack(issueTitle || data.message)}*`,
          },
          { type: 'mrkdwn', text: `*Assigned by*\n${escapeSlack(actorName)}` },
        ],
      },
    ];

    const url = this.buildIssueUrl(projectKey, data.issueId);
    if (url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in BB-PM' },
            url,
            style: 'primary',
          },
        ],
      });
    }

    await this.slackService.sendDirectMessage(
      recipient.slackUserId,
      fallbackText,
      blocks,
    );
  }

  private buildIssueUrl(projectKey: string, issueId?: string): string | null {
    if (!projectKey || !issueId) return null;
    const base =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return `${base}/projects/${projectKey}/board?open=${issueId}`;
  }
}

// Minimal Slack-mrkdwn escape: only escape the three characters that have
// special meaning in Slack text fields (https://api.slack.com/reference/surfaces/formatting#escaping)
function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
