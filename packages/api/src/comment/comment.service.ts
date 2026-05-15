import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT, MAX_MENTIONS } from '../common/constants.js';
import { stripHtml } from '../common/strip-html.js';
import { hcmTimestamp } from '../common/hcm-time.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { UpdateCommentDto } from './dto/update-comment.dto.js';
import { NotificationService } from '../notification/notification.service.js';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  private async verifyIssue(issueId: string, projectId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }
    return issue;
  }

  async create(
    projectId: string,
    issueId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    await this.verifyIssue(issueId, projectId);

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        issueId,
        userId,
      },
      include: {
        user: { select: USER_SELECT },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Send notifications
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        number: true,
        title: true,
        assigneeId: true,
        projectId: true,
        project: { select: { key: true } },
      },
    });

    if (issue) {
      const issueKey = `${issue.project.key}-${issue.number}`;
      const actorName = comment.user?.name ?? 'Someone';

      // Notify assignee about new comment
      if (issue.assigneeId && issue.assigneeId !== userId) {
        this.notificationService
          .create({
            type: 'COMMENTED',
            message: `${actorName} commented on ${issueKey} "${issue.title}"`,
            userId: issue.assigneeId,
            issueId,
            projectId: issue.projectId,
            actorId: userId,
          })
          .catch(() => {});
      }

      // Resolve mentioned users. Prefer the explicit list the client
      // sent from the @-picker; fall back to regex over content for
      // older clients (and to catch plain-text "@name" without picker).
      const explicitIds = (dto.mentionedUserIds ?? []).slice(0, MAX_MENTIONS);
      let mentionedUserIds: string[] = explicitIds;
      let resolutionSource: 'explicit' | 'regex' | 'none' = explicitIds.length
        ? 'explicit'
        : 'none';
      if (mentionedUserIds.length === 0) {
        const mentionPattern = /@([a-zA-Z0-9._-]{2,30})/g;
        const mentionNames = [...dto.content.matchAll(mentionPattern)]
          .map((m) => m[1])
          .slice(0, MAX_MENTIONS);
        if (mentionNames.length > 0) {
          const found = await this.prisma.user.findMany({
            where: { name: { in: mentionNames } },
            select: { id: true },
          });
          mentionedUserIds = found.map((u) => u.id);
          resolutionSource = 'regex';
        }
      }

      this.logger.log(
        `[Mention] [${hcmTimestamp()}] comment on ${issueKey} by ${userId} ` +
          `— source=${resolutionSource} ids=[${mentionedUserIds.join(',')}] ` +
          `(explicit=${explicitIds.length})`,
      );

      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId === userId) {
          this.logger.log(
            `[Mention] [${hcmTimestamp()}] skipping self-mention ${mentionedUserId}`,
          );
          continue;
        }
        // Skip if this user is already getting the COMMENTED notification
        // — the MENTIONED one would be redundant in their inbox.
        if (mentionedUserId === issue.assigneeId) {
          this.logger.log(
            `[Mention] [${hcmTimestamp()}] skipping ${mentionedUserId} ` +
              `— already getting COMMENTED notification (is assignee)`,
          );
          continue;
        }
        this.logger.log(
          `[Mention] [${hcmTimestamp()}] firing MENTIONED → user=${mentionedUserId} ` +
            `issue=${issueKey}`,
        );
        this.notificationService
          .create({
            type: 'MENTIONED',
            message: `${actorName} mentioned you in ${issueKey} "${issue.title}"`,
            userId: mentionedUserId,
            issueId,
            projectId: issue.projectId,
            actorId: userId,
            meta: {
              projectKey: issue.project.key,
              issueNumber: issue.number,
              issueTitle: issue.title,
              actorName,
              commentSnippet: stripHtml(dto.content).slice(0, 200),
              mentionSource: 'comment',
            },
          })
          .catch((err: unknown) => {
            this.logger.error(
              `[Mention] [${hcmTimestamp()}] notification.create FAILED for ` +
                `user=${mentionedUserId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }
    }

    return comment;
  }

  async findByIssue(projectId: string, issueId: string, page = 1, limit = 50) {
    await this.verifyIssue(issueId, projectId);

    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { issueId },
        include: {
          user: { select: USER_SELECT },
          attachments: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.comment.count({ where: { issueId } }),
    ]);

    return { items, total, page: safePage, limit: safeLimit };
  }

  async update(
    issueId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.issueId !== issueId) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: {
        user: { select: USER_SELECT },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async remove(issueId: string, commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.issueId !== issueId) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { deleted: true };
  }
}

