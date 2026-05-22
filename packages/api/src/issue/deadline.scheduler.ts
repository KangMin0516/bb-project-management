import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from '../notification/notification.service.js';

/**
 * Hourly cron that nudges assignees about issues approaching or past
 * their due date. Phase 1 (PM-79) emits in-app notifications only;
 * Slack DM dispatch is wired in Phase 2 when the per-notification-type
 * formatter is added.
 *
 * Idempotency: before creating a `DEADLINE_WARNING` or `DEADLINE_OVERDUE`
 * row, query existing notifications for the same `(userId, issueId, type)`.
 * If a row already exists we skip — avoids the cron re-firing every
 * hour for the same issue. Edge case: if the assignee changes the
 * dueDate, no new notification fires (the original row blocks re-fire);
 * acceptable Phase-1 trade-off, refine in Phase 2 by also matching on
 * `meta.dueAt`.
 */
@Injectable()
export class DeadlineScheduler {
  private readonly logger = new Logger(DeadlineScheduler.name);
  /** How far ahead of `dueDate` we fire the "approaching" warning. */
  private static readonly WARN_BEFORE_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Every hour on the dot. */
  @Cron('0 0 * * * *')
  async run(): Promise<void> {
    try {
      const now = new Date();
      const warnHorizon = new Date(now.getTime() + DeadlineScheduler.WARN_BEFORE_MS);

      // Two windows: due within next 24h (warning) and already past due
      // (overdue). One round-trip each. Issues with no assignee fall
      // back to the creator below.
      const candidates = await this.prisma.issue.findMany({
        where: {
          status: { notIn: ['DONE', 'CANCELED'] },
          archivedAt: null,
          dueDate: { not: null, lte: warnHorizon },
        },
        select: {
          id: true,
          number: true,
          title: true,
          dueDate: true,
          assigneeId: true,
          creatorId: true,
          projectId: true,
          project: { select: { key: true } },
        },
      });

      let warned = 0;
      let overdue = 0;
      for (const issue of candidates) {
        if (!issue.dueDate) continue;
        const recipientId = issue.assigneeId ?? issue.creatorId;
        if (!recipientId) continue;
        const isOverdue = issue.dueDate.getTime() < now.getTime();
        const type: 'DEADLINE_WARNING' | 'DEADLINE_OVERDUE' = isOverdue
          ? 'DEADLINE_OVERDUE'
          : 'DEADLINE_WARNING';

        const exists = await this.prisma.notification.findFirst({
          where: { userId: recipientId, issueId: issue.id, type },
          select: { id: true },
        });
        if (exists) continue;

        const issueKey = `${issue.project?.key ?? ''}-${issue.number}`;
        const message = isOverdue
          ? `${issueKey} "${issue.title}" is overdue`
          : `${issueKey} "${issue.title}" is due within 24h`;
        try {
          await this.notifications.create({
            type,
            message,
            userId: recipientId,
            issueId: issue.id,
            projectId: issue.projectId,
            meta: {
              projectKey: issue.project?.key ?? undefined,
              issueNumber: issue.number,
              issueTitle: issue.title,
            },
          });
          if (isOverdue) overdue += 1;
          else warned += 1;
        } catch (err) {
          this.logger.warn(
            `Failed to notify ${recipientId} for ${issueKey}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (warned + overdue > 0) {
        this.logger.log(
          `Deadline notifications: ${warned} warnings (≤24h), ${overdue} overdue`,
        );
      }
    } catch (err) {
      this.logger.error(
        'DeadlineScheduler run failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
