import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateIssueDto } from './dto/create-issue.dto.js';
import type { UpdateIssueDto } from './dto/update-issue.dto.js';
import type { QueryIssueDto } from './dto/query-issue.dto.js';
import type { IssueWhereInput } from '../../generated/prisma/models.js';
import type { IssueStatus } from '../../generated/prisma/enums.js';
import { USER_SELECT } from '../common/constants.js';

const ORDER_GAP = 1000;

const issueInclude = {
  assignee: { select: USER_SELECT },
  creator: { select: USER_SELECT },
  labels: { include: { label: true } },
  parent: { select: { id: true, number: true, title: true } },
  _count: { select: { children: true } },
} as const;

@Injectable()
export class IssueService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, dto: CreateIssueDto, creatorId: string) {
    const { labelIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Auto-increment number within project
      const lastIssue = await tx.issue.findFirst({
        where: { projectId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (lastIssue?.number ?? 0) + 1;

      // Calculate order (append to end of status column)
      const lastInColumn = await tx.issue.findFirst({
        where: { projectId, status: data.status ?? 'BACKLOG' },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const order = (lastInColumn?.order ?? 0) + ORDER_GAP;

      const issue = await tx.issue.create({
        data: {
          ...data,
          number,
          order,
          projectId,
          creatorId,
          ...(labelIds?.length && {
            labels: {
              create: labelIds.map((labelId) => ({ labelId })),
            },
          }),
        },
        include: issueInclude,
      });

      return issue;
    });
  }

  async findAll(projectId: string, query: QueryIssueDto) {
    const { status, priority, type, assigneeId, search, page = 1, limit = 50 } = query;

    const where: IssueWhereInput = {
      projectId,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(type && { type }),
      ...(assigneeId && { assigneeId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        include: issueInclude,
        orderBy: [{ status: 'asc' }, { order: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByStatus(projectId: string) {
    // Kanban board: group issues by status with a per-column limit to prevent
    // performance issues on projects with many completed/canceled issues.
    const MAX_PER_COLUMN = 50;

    const statuses: IssueStatus[] = [
      'BACKLOG' as IssueStatus,
      'TODO' as IssueStatus,
      'IN_PROGRESS' as IssueStatus,
      'REVIEW_QA' as IssueStatus,
      'DONE' as IssueStatus,
      'CANCELED' as IssueStatus,
      'RECHECK' as IssueStatus,
    ];

    const grouped: Record<string, Awaited<ReturnType<typeof this.prisma.issue.findMany>>> = {};

    await Promise.all(
      statuses.map(async (status) => {
        const issues = await this.prisma.issue.findMany({
          where: { projectId, status },
          include: issueInclude,
          orderBy: { order: 'asc' },
          take: MAX_PER_COLUMN,
        });
        if (issues.length > 0) {
          grouped[status] = issues;
        }
      }),
    );

    return grouped;
  }

  async findOne(projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        ...issueInclude,
        children: {
          include: {
            assignee: { select: USER_SELECT },
          },
          orderBy: { order: 'asc' },
        },
        activities: {
          include: {
            user: { select: USER_SELECT },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }

    return issue;
  }

  async update(
    projectId: string,
    issueId: string,
    dto: UpdateIssueDto,
    userId: string,
  ) {
    const existing = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }

    const { labelIds, ...data } = dto;

    // Track changes for activity log
    const TRACKED_FIELDS = ['title', 'description', 'status', 'priority', 'type', 'assigneeId', 'parentId'] as const;
    const activities: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    for (const key of TRACKED_FIELDS) {
      const value = data[key as keyof typeof data];
      const oldVal = existing[key as keyof typeof existing];
      const oldStr = oldVal != null ? String(oldVal) : null;
      const newStr = value != null ? String(value) : null;
      if (value !== undefined && newStr !== oldStr) {
        activities.push({
          field: key,
          oldValue: oldStr,
          newValue: newStr,
        });
      }
    }

    const issue = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        ...data,
        ...(labelIds !== undefined && {
          labels: {
            deleteMany: {},
            create: labelIds.map((labelId) => ({ labelId })),
          },
        }),
        ...(activities.length > 0 && {
          activities: {
            create: activities.map((a) => ({
              ...a,
              userId,
            })),
          },
        }),
      },
      include: issueInclude,
    });

    return issue;
  }

  async reorder(
    projectId: string,
    issueId: string,
    targetStatus: string,
    targetOrder: number,
    userId: string,
  ) {
    const existing = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }

    const activities: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    if (existing.status !== targetStatus) {
      activities.push({
        field: 'status',
        oldValue: existing.status,
        newValue: targetStatus,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issueId },
        data: {
          status: targetStatus as IssueStatus,
          order: targetOrder,
          ...(activities.length > 0 && {
            activities: {
              create: activities.map((a) => ({ ...a, userId })),
            },
          }),
        },
        include: issueInclude,
      });

      // Renormalize if gap between adjacent orders is too small
      const neighbors = await tx.issue.findMany({
        where: {
          projectId,
          status: targetStatus as IssueStatus,
          id: { not: issueId },
          order: { gte: targetOrder - 1, lte: targetOrder + 1 },
        },
        select: { order: true },
      });

      const needsRenormalize = neighbors.some(
        (n) => Math.abs(n.order - targetOrder) < 0.001,
      );

      if (needsRenormalize) {
        const allInColumn = await tx.issue.findMany({
          where: { projectId, status: targetStatus as IssueStatus },
          orderBy: { order: 'asc' },
          select: { id: true },
        });
        await Promise.all(
          allInColumn.map((issue, idx) =>
            tx.issue.update({
              where: { id: issue.id },
              data: { order: (idx + 1) * ORDER_GAP },
            }),
          ),
        );
      }

      return updated;
    });
  }

  async remove(projectId: string, issueId: string) {
    const existing = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }

    await this.prisma.issue.delete({ where: { id: issueId } });
    return { deleted: true };
  }
}
