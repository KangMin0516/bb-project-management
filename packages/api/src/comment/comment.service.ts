import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { UpdateCommentDto } from './dto/update-comment.dto.js';

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.comment.create({
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
