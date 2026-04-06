import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateIssueDto } from './dto/create-issue.dto.js';
import type { UpdateIssueDto } from './dto/update-issue.dto.js';
import type { QueryIssueDto } from './dto/query-issue.dto.js';
import type { IssueWhereInput } from '../../generated/prisma/models.js';

const ORDER_GAP = 1000;

const issueInclude = {
  assignee: { select: { id: true, email: true, name: true, avatar: true } },
  creator: { select: { id: true, email: true, name: true, avatar: true } },
  labels: { include: { label: true } },
  parent: { select: { id: true, number: true, title: true } },
  _count: { select: { children: true } },
} as const;

@Injectable()
export class IssueService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, dto: CreateIssueDto, creatorId: string) {
    const { labelIds, ...data } = dto;

    // Auto-increment number within project
    const lastIssue = await this.prisma.issue.findFirst({
      where: { projectId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (lastIssue?.number ?? 0) + 1;

    // Calculate order (append to end of status column)
    const lastInColumn = await this.prisma.issue.findFirst({
      where: { projectId, status: data.status ?? 'BACKLOG' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = (lastInColumn?.order ?? 0) + ORDER_GAP;

    const issue = await this.prisma.issue.create({
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
    // Kanban board: group issues by status with order
    const issues = await this.prisma.issue.findMany({
      where: { projectId },
      include: issueInclude,
      orderBy: { order: 'asc' },
    });

    // Group by status
    const grouped: Record<string, typeof issues> = {};
    for (const issue of issues) {
      if (!grouped[issue.status]) {
        grouped[issue.status] = [];
      }
      grouped[issue.status].push(issue);
    }

    return grouped;
  }

  async findOne(projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        ...issueInclude,
        children: {
          include: {
            assignee: { select: { id: true, email: true, name: true, avatar: true } },
          },
          orderBy: { order: 'asc' },
        },
        activities: {
          include: {
            user: { select: { id: true, email: true, name: true, avatar: true } },
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
    const activities: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    for (const [key, value] of Object.entries(data)) {
      const oldVal = existing[key as keyof typeof existing];
      if (value !== undefined && String(value) !== String(oldVal)) {
        activities.push({
          field: key,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: value != null ? String(value) : null,
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

    return this.prisma.issue.update({
      where: { id: issueId },
      data: {
        status: targetStatus as any,
        order: targetOrder,
        ...(activities.length > 0 && {
          activities: {
            create: activities.map((a) => ({ ...a, userId })),
          },
        }),
      },
      include: issueInclude,
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
