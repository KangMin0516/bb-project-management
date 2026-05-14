import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ISSUE_MAX_PER_COLUMN, USER_SELECT } from '../../common/constants.js';
import {
  IssueType,
  type IssueStatus,
} from '../../../generated/prisma/enums.js';
import type { QueryIssueDto } from '../dto/query-issue.dto.js';

/**
 * Read-side counterpart to the Issue use cases (CQRS-lite per
 * refactor-plan.md §6.3). Returns Prisma row shapes verbatim — there
 * is no upside to converting deep includes into a domain entity that
 * the controller would just have to re-serialise. The aggregate domain
 * is only for write-time invariants; reads stay flat.
 *
 * Methods mirror the legacy IssueService read paths byte-identical so
 * controllers can swap-in without touching the FE contract.
 */
export const ISSUE_INCLUDE = {
  assignee: { select: USER_SELECT },
  reviewerAssignee: { select: USER_SELECT },
  creator: { select: USER_SELECT },
  labels: { include: { label: true } },
  components: { include: { component: true } },
  parent: { select: { id: true, number: true, title: true, type: true } },
  _count: { select: { children: true } },
} as const;

@Injectable()
export class IssueQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string, query: QueryIssueDto) {
    const {
      status,
      priority,
      type,
      assigneeId,
      search,
      sortBy,
      sortOrder,
      page = 1,
      limit = 50,
      includeArchived = false,
    } = query;

    const where = {
      projectId,
      ...(!includeArchived && { archivedAt: null }),
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

    const orderBy = sortBy
      ? { [sortBy]: sortOrder || 'desc' }
      : [{ status: 'asc' as const }, { order: 'asc' as const }];

    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        include: ISSUE_INCLUDE,
        orderBy,
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

  /**
   * Board view — issues grouped by status with a per-column limit to
   * keep large completed/canceled columns from dominating the payload.
   * Archived SUB_TASKs are always included so parent cards render the
   * right child count.
   */
  async findByStatus(projectId: string, includeArchived = false) {
    const statuses: IssueStatus[] = [
      'BACKLOG',
      'TODO',
      'IN_PROGRESS',
      'REVIEW_QA',
      'DONE',
      'CANCELED',
    ];
    const grouped: Record<string, unknown[]> = {};

    await Promise.all(
      statuses.map(async (status) => {
        const issues = await this.prisma.issue.findMany({
          where: {
            projectId,
            status,
            ...(!includeArchived && {
              OR: [{ archivedAt: null }, { type: IssueType.SUB_TASK }],
            }),
          },
          include: ISSUE_INCLUDE,
          orderBy: { order: 'asc' },
          take: ISSUE_MAX_PER_COLUMN,
        });
        if (issues.length > 0) grouped[status] = issues;
      }),
    );

    return grouped;
  }

  async findOne(projectId: string, issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        ...ISSUE_INCLUDE,
        parent: {
          select: {
            id: true,
            number: true,
            title: true,
            type: true,
            parent: {
              select: { id: true, number: true, title: true, type: true },
            },
          },
        },
        children: {
          include: { assignee: { select: USER_SELECT } },
          orderBy: { order: 'asc' },
        },
        activities: {
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        attachments: { orderBy: { createdAt: 'desc' } },
        sourceLinks: {
          include: {
            targetIssue: {
              select: {
                id: true,
                number: true,
                title: true,
                status: true,
                priority: true,
                type: true,
                project: { select: { key: true } },
              },
            },
            creator: { select: { id: true, name: true } },
          },
        },
        targetLinks: {
          include: {
            sourceIssue: {
              select: {
                id: true,
                number: true,
                title: true,
                status: true,
                priority: true,
                type: true,
                project: { select: { key: true } },
              },
            },
            creator: { select: { id: true, name: true } },
          },
        },
      },
    });
  }
}
