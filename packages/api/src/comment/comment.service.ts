import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { UpdateCommentDto } from './dto/update-comment.dto.js';
import { NotificationService } from '../notification/notification.service.js';

@Injectable()
export class CommentService {
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
        this.notificationService.create({
          type: 'COMMENTED',
          message: `${actorName} commented on ${issueKey} "${issue.title}"`,
          userId: issue.assigneeId,
          issueId,
          projectId: issue.projectId,
          actorId: userId,
        }).catch(() => {});
      }

      // Parse @mentions and notify mentioned users
      const mentionPattern = /@([\w.]+)/g;
      const mentions = [...dto.content.matchAll(mentionPattern)].map((m) => m[1]);
      if (mentions.length > 0) {
        const mentionedUsers = await this.prisma.user.findMany({
          where: { name: { in: mentions } },
          select: { id: true },
        });
        for (const mentionedUser of mentionedUsers) {
          if (mentionedUser.id !== userId && mentionedUser.id !== issue.assigneeId) {
            this.notificationService.create({
              type: 'MENTIONED',
              message: `${actorName} mentioned you in ${issueKey} "${issue.title}"`,
              userId: mentionedUser.id,
              issueId,
              projectId: issue.projectId,
              actorId: userId,
            }).catch(() => {});
          }
        }
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
