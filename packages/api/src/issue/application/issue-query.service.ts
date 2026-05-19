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

/**
 * Fields the FE can sort by. Mirrors `SORT_FIELDS` in the web layer.
 * Enums (priority, status) rely on Postgres enum declaration order in
 * `schema.prisma`: `HIGH/MEDIUM/LOW` and `BACKLOG/TODO/.../CANCELED`,
 * so `desc` on priority puts HIGH first and `asc` on status follows
 * the workflow — no custom collator needed.
 */
const SORTABLE_FIELDS = new Set([
  'priority',
  'dueDate',
  'startDate',
  'createdAt',
  'updatedAt',
  'title',
  'number',
  'status',
  'order',
]);
const NULLABLE_DATE_FIELDS = new Set([
  'dueDate',
  'startDate',
  'focusDate',
]);

type OrderByEntry = Record<string, 'asc' | 'desc' | { sort: 'asc' | 'desc'; nulls: 'last' | 'first' }>;

/**
 * Parse `?sort=priority:desc,dueDate:asc` into a Prisma orderBy array.
 * Invalid fields are dropped silently so a stale URL doesn't 400 the
 * whole list. Date fields get `nulls: 'last'` so issues without due
 * dates fall to the bottom regardless of direction.
 */
function parseSortParam(sort?: string): OrderByEntry[] | null {
  if (!sort) return null;
  const out: OrderByEntry[] = [];
  for (const part of sort.split(',')) {
    const [field, dir] = part.trim().split(':');
    if (!field || !SORTABLE_FIELDS.has(field)) continue;
    const direction: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
    out.push(
      NULLABLE_DATE_FIELDS.has(field)
        ? { [field]: { sort: direction, nulls: 'last' } }
        : { [field]: direction },
    );
  }
  return out.length > 0 ? out : null;
}

@Injectable()
export class IssueQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string, query: QueryIssueDto) {
    const {
      status,
      priority,
      type,
      source,
      assigneeId,
      search,
      sort,
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
      ...(source && { source }),
      ...(assigneeId && { assigneeId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    // Resolution order: explicit `sort=` (multi-field) > legacy
    // `sortBy/sortOrder` > default (status workflow, then drag-order).
    const orderBy =
      parseSortParam(sort) ??
      (sortBy
        ? [{ [sortBy]: (sortOrder || 'desc') as 'asc' | 'desc' }]
        : [{ status: 'asc' as const }, { order: 'asc' as const }]);

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
  async findByStatus(
    projectId: string,
    includeArchived = false,
    sort?: string,
  ) {
    const statuses: IssueStatus[] = [
      'BACKLOG',
      'TODO',
      'IN_PROGRESS',
      'REVIEW_QA',
      'RECHECK',
      'DONE',
      'CANCELED',
    ];
    const grouped: Record<string, unknown[]> = {};
    // User-supplied sort wins; default to manual `order` (drag-drop).
    const orderBy = parseSortParam(sort) ?? [{ order: 'asc' as const }];

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
          orderBy,
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
