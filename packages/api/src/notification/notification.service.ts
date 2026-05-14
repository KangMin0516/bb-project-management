import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MESSAGING_PORT,
  type MessageBlock,
  type MessagingPort,
} from '../common/ports/messaging.port.js';
import { OutboxEventBus } from '../outbox/outbox-event-bus.js';
import { OutboxRepository } from '../outbox/outbox.repository.js';
import { NOTIFICATION_LIMIT } from '../common/constants.js';

/** Routing key for the deferred assignment delivery event. */
const ISSUE_ASSIGNED_DELIVERY = 'IssueAssignedDelivery';

type NotificationType =
  | 'ASSIGNED'
  | 'REVIEWER_ASSIGNED'
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
    /** Plain-text snippet of the comment that triggered the mention. */
    commentSnippet?: string;
  };
}

/**
 * 10 second grace window after an assignee change before we actually deliver
 * the in-app + Slack notification. Lets the user cancel ("undo") a mis-click
 * without spamming the picked-by-mistake user. In-memory only — on restart
 * any pending deliveries are dropped, which is acceptable for a 10s window.
 */
const ASSIGNMENT_DELIVERY_DELAY_MS = 10_000;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Keyed by `${type}:${issueId}` so an assignee change and a reviewer change
   * on the same issue can be pending simultaneously without overwriting each
   * other. Within a single (type, issue) slot, a fresh change overwrites the
   * previous one — that's the desired coalesce behaviour for rapid clicks.
   */
  private readonly pendingAssignmentTimers = new Map<string, NodeJS.Timeout>();

  private pendingKey(
    type: 'ASSIGNED' | 'REVIEWER_ASSIGNED',
    issueId: string,
  ): string {
    return `${type}:${issueId}`;
  }

  constructor(
    private prisma: PrismaService,
    @Inject(MESSAGING_PORT) private messaging: MessagingPort,
    private config: ConfigService,
    private outboxBus: OutboxEventBus,
    private outboxRepo: OutboxRepository,
  ) {}

  /**
   * Feature flag — when true, assignment notifications go through the
   * transactional outbox (crash-safe; lost on restart no longer
   * possible). Default false so production behaviour is unchanged
   * until we explicitly toggle.
   */
  private useOutboxForAssignment(): boolean {
    return this.config.get<string>('USE_OUTBOX_FOR_ISSUE_ASSIGNED') === 'true';
  }

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
    if (data.type === 'ASSIGNED' || data.type === 'REVIEWER_ASSIGNED') {
      this.deliverSlackAssignedDm(data).catch((err) =>
        this.logger.warn(
          `Slack ${data.type === 'ASSIGNED' ? 'assignment' : 'reviewer'} DM failed`,
          err instanceof Error ? err.message : String(err),
        ),
      );
    }

    if (data.type === 'MENTIONED') {
      this.deliverSlackMentionDm(data).catch((err) =>
        this.logger.warn(
          'Slack mention DM failed',
          err instanceof Error ? err.message : String(err),
        ),
      );
    }

    return notification;
  }

  // ─── Deferred delivery for assignment changes ──────────────

  /**
   * Schedule an assignment / reviewer-assignment notification to fire after a
   * grace window so the user can undo a mis-click. If another change of the
   * same type for the same issue is scheduled within the window, the previous
   * one is cancelled and replaced.
   *
   * The in-app notification row is NOT created until the timer fires, so an
   * undone assignment leaves no trace in the bell dropdown.
   */
  scheduleAssignmentNotification(data: CreateNotificationInput) {
    if (data.type !== 'ASSIGNED' && data.type !== 'REVIEWER_ASSIGNED') {
      throw new Error(
        'scheduleAssignmentNotification only supports ASSIGNED / REVIEWER_ASSIGNED',
      );
    }
    if (!data.issueId) return;
    // Don't schedule a DM the actor would send to themselves; matches create().
    if (data.actorId === data.userId) return;

    if (this.useOutboxForAssignment()) {
      // Outbox path — durable. Replace any prior pending row for the
      // same (type, issue) slot so rapid clicks coalesce (same
      // semantics as the in-memory timer's overwrite behaviour).
      void this.scheduleViaOutbox(data);
      return;
    }

    // Legacy in-memory path (DEFAULT). Lost on restart; kept until the
    // outbox path is observed stable in production. See P5 +
    // refactor-plan.md §7.5 M2.
    const key = this.pendingKey(data.type, data.issueId);
    this.cancelPendingAssignmentByKey(key);

    const timer = setTimeout(() => {
      this.pendingAssignmentTimers.delete(key);
      this.create(data).catch((err) =>
        this.logger.warn(
          'Deferred assignment notification failed',
          err instanceof Error ? err.message : String(err),
        ),
      );
    }, ASSIGNMENT_DELIVERY_DELAY_MS);
    // Don't keep the Node process alive just for a pending toast countdown.
    timer.unref?.();

    this.pendingAssignmentTimers.set(key, timer);
  }

  private async scheduleViaOutbox(data: CreateNotificationInput) {
    if (!data.issueId) return;
    try {
      // Coalesce: drop any prior undelivered row for the same slot
      // before appending the new one. Matches the legacy timer's
      // "overwrite previous pending" semantics.
      await this.outboxRepo.deleteUndelivered({
        eventType: ISSUE_ASSIGNED_DELIVERY,
        aggregateType: 'Issue',
        aggregateId: data.issueId,
      });
      await this.outboxBus.publish({
        type: ISSUE_ASSIGNED_DELIVERY,
        aggregateType: 'Issue',
        aggregateId: data.issueId,
        payload: data,
        deliverAfter: new Date(Date.now() + ASSIGNMENT_DELIVERY_DELAY_MS),
      });
    } catch (err) {
      // Same swallow semantics as the legacy timer.create failure path —
      // the in-app row is the source of truth, but here it's deferred
      // too. Log loudly so an outbox outage is visible.
      this.logger.error(
        'Failed to enqueue outbox row for assignment notification',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Cancel a pending assignment notification for an issue. `type` defaults to
   * `'ASSIGNED'` for backward-compatibility with the original undo flow.
   * Returns true if a pending delivery was found and removed.
   */
  cancelPendingAssignment(
    issueId: string,
    type: 'ASSIGNED' | 'REVIEWER_ASSIGNED' = 'ASSIGNED',
  ): boolean {
    if (this.useOutboxForAssignment()) {
      // Best-effort delete; return value reflects whether the legacy
      // map had a timer (kept for callers checking the boolean). Fire
      // the DB delete without blocking — undo UX shouldn't wait on it.
      void this.outboxRepo
        .deleteUndelivered({
          eventType: ISSUE_ASSIGNED_DELIVERY,
          aggregateType: 'Issue',
          aggregateId: issueId,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to cancel outbox row for ${issueId}: ${msg}`,
          );
        });
      // Suppress unused param warning when both type+legacy fall-through
      // are skipped.
      void type;
      return true;
    }
    return this.cancelPendingAssignmentByKey(this.pendingKey(type, issueId));
  }

  private cancelPendingAssignmentByKey(key: string): boolean {
    const timer = this.pendingAssignmentTimers.get(key);
    if (!timer) return false;
    clearTimeout(timer);
    this.pendingAssignmentTimers.delete(key);
    return true;
  }

  // ─── Outbox handler ──────────────────────────────────────────
  //
  // Registered via NotificationModule on init. The publisher calls this
  // when an `IssueAssignedDelivery` row becomes due. Performs the
  // state-check idempotency (skip if the issue's current assignee no
  // longer matches the payload — handles A→B→A within the grace
  // window without spamming the wrong user).

  async handleIssueAssignedDelivery(payload: CreateNotificationInput) {
    if (!payload.issueId) return;
    if (payload.type !== 'ASSIGNED' && payload.type !== 'REVIEWER_ASSIGNED') {
      return;
    }

    const issue = await this.prisma.issue.findUnique({
      where: { id: payload.issueId },
      select: { assigneeId: true, reviewerAssigneeId: true },
    });
    if (!issue) return; // issue deleted; skip silently

    const currentTarget =
      payload.type === 'ASSIGNED' ? issue.assigneeId : issue.reviewerAssigneeId;
    if (currentTarget !== payload.userId) {
      this.logger.debug(
        `Skipping ${payload.type} delivery for issue ${payload.issueId} — current target ${currentTarget} ≠ payload ${payload.userId}`,
      );
      return;
    }

    await this.create(payload);
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

    const isReviewer = data.type === 'REVIEWER_ASSIGNED';
    const verbPast = isReviewer ? 'set as the reviewer of' : 'been assigned';
    const headerEmoji = isReviewer ? ':mag:' : ':clipboard:';
    const headerLabel = isReviewer
      ? "*You're the reviewer of a new issue*"
      : "*You've been assigned a new issue*";
    const byFieldLabel = isReviewer ? '*Set by*' : '*Assigned by*';

    const fallbackText =
      issueKey && issueTitle
        ? `You've ${verbPast} ${issueKey} "${issueTitle}" by ${actorName}`
        : data.message;

    const blocks: MessageBlock[] = [
      { type: 'section', text: `${headerEmoji} ${headerLabel}` },
      {
        type: 'fields',
        fields: [
          issueKey
            ? `*${issueKey}*\n${escapeSlack(issueTitle)}`
            : `*${escapeSlack(issueTitle || data.message)}*`,
          `${byFieldLabel}\n${escapeSlack(actorName)}`,
        ],
      },
    ];

    const url = this.buildIssueUrl(projectKey, data.issueId);
    if (url) {
      blocks.push({
        type: 'button_link',
        text: 'View in BB-PM',
        url,
        style: 'primary',
      });
    }

    const result = await this.messaging.sendDirectMessage(
      recipient.slackUserId,
      fallbackText,
      blocks,
    );
    // Adapter swallows internally and logs; this branch is for the rare
    // case we want to surface a delivery miss to per-notification metrics
    // later — keeps the in-app row authoritative regardless.
    if (!result.delivered) {
      this.logger.debug(
        `Slack DM not delivered for ${data.type} → ${recipient.slackUserId}: ${result.reason}`,
      );
    }
  }

  private async deliverSlackMentionDm(data: CreateNotificationInput) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { slackUserId: true },
    });
    if (!recipient?.slackUserId) return;

    const meta = data.meta ?? {};
    const projectKey = meta.projectKey ?? '';
    const issueNumber = meta.issueNumber;
    const issueTitle = meta.issueTitle ?? '';
    const actorName = meta.actorName ?? 'Someone';
    const issueKey = issueNumber != null ? `${projectKey}-${issueNumber}` : '';
    const snippet = meta.commentSnippet ?? '';

    const fallbackText =
      issueKey && issueTitle
        ? `${actorName} mentioned you in ${issueKey} "${issueTitle}"`
        : data.message;

    const blocks: MessageBlock[] = [
      {
        type: 'section',
        text: ':speech_balloon: *You were mentioned in a comment*',
      },
      {
        type: 'fields',
        fields: [
          issueKey
            ? `*${issueKey}*\n${escapeSlack(issueTitle)}`
            : `*${escapeSlack(issueTitle || data.message)}*`,
          `*By*\n${escapeSlack(actorName)}`,
        ],
      },
    ];

    if (snippet) {
      blocks.push({ type: 'section', text: `> ${escapeSlack(snippet)}` });
    }

    const url = this.buildIssueUrl(projectKey, data.issueId);
    if (url) {
      blocks.push({
        type: 'button_link',
        text: 'View in BB-PM',
        url,
        style: 'primary',
      });
    }

    const result = await this.messaging.sendDirectMessage(
      recipient.slackUserId,
      fallbackText,
      blocks,
    );
    if (!result.delivered) {
      this.logger.debug(
        `Slack DM not delivered for MENTIONED → ${recipient.slackUserId}: ${result.reason}`,
      );
    }
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
