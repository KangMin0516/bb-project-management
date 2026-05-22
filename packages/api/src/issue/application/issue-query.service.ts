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
const NULLABLE_DATE_FIELDS = new Set(['dueDate', 'startDate', 'focusDate']);

type OrderByEntry = Record<
  string,
  'asc' | 'desc' | { sort: 'asc' | 'desc'; nulls: 'last' | 'first' }
>;

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
      dueDateFrom,
      dueDateTo,
      hasDueDate,
    } = query;

    // Compose the dueDate filter. `hasDueDate` is mutually exclusive
    // with the range form — Calendar's "Unscheduled" panel sends
    // `hasDueDate=false`; the month grid sends `dueDateFrom/To`. If both
    // arrived somehow, range wins (it's the more specific signal).
    const dueDateFilter = (() => {
      if (dueDateFrom || dueDateTo) {
        const range: { gte?: Date; lte?: Date } = {};
        if (dueDateFrom) range.gte = new Date(dueDateFrom);
        if (dueDateTo) range.lte = new Date(dueDateTo);
        return range;
      }
      // Parse the string-form param into a real null filter. See DTO
      // comment for why this isn't a boolean.
      if (hasDueDate === 'false') return { equals: null };
      if (hasDueDate === 'true') return { not: null };
      return undefined;
    })();

    const where = {
      projectId,
      ...(!includeArchived && { archivedAt: null }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(type && { type }),
      ...(source && { source }),
      ...(assigneeId && { assigneeId }),
      ...(dueDateFilter && { dueDate: dueDateFilter }),
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
        ? [{ [sortBy]: sortOrder || 'desc' }]
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

  /**
   * Table of Content — flat tree of Domains and their Epics, plus a
   * separate bucket for Epics that don't have a Domain parent yet
   * (migration backward-compat). Counts are aggregated on Task/Bug/
   * Sub-task children of each Epic, irrespective of nesting depth.
   *
   * Two queries:
   *   1. Fetch all DOMAIN + EPIC rows for the project.
   *   2. groupBy descendant counts on parentId.
   */
  async findTableOfContent(projectId: string): Promise<{
    domains: Array<{
      id: string;
      title: string;
      epics: Array<{
        id: string;
        title: string;
        status: IssueStatus;
        taskCount: number;
        doneCount: number;
      }>;
    }>;
    orphanEpics: Array<{
      id: string;
      title: string;
      status: IssueStatus;
      taskCount: number;
      doneCount: number;
    }>;
  }> {
    const rows = await this.prisma.issue.findMany({
      where: {
        projectId,
        archivedAt: null,
        type: { in: [IssueType.DOMAIN, IssueType.EPIC] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        parentId: true,
        order: true,
      },
      orderBy: [{ type: 'asc' }, { order: 'asc' }, { title: 'asc' }],
    });

    const epics = rows.filter((r) => r.type === IssueType.EPIC);
    const domains = rows.filter((r) => r.type === IssueType.DOMAIN);

    // Count children (any type) grouped by parentId. Aggregated in one
    // SQL call to avoid N+1; computed counts are 0 for epics with no
    // children.
    const epicIds = epics.map((e) => e.id);
    const counts =
      epicIds.length > 0
        ? await this.prisma.issue.groupBy({
            by: ['parentId', 'status'],
            where: {
              parentId: { in: epicIds },
              archivedAt: null,
            },
            _count: { _all: true },
          })
        : [];

    const totalByEpic = new Map<string, number>();
    const doneByEpic = new Map<string, number>();
    for (const c of counts) {
      if (!c.parentId) continue;
      const n = c._count._all;
      totalByEpic.set(c.parentId, (totalByEpic.get(c.parentId) ?? 0) + n);
      if (c.status === 'DONE') {
        doneByEpic.set(c.parentId, (doneByEpic.get(c.parentId) ?? 0) + n);
      }
    }

    const epicView = (e: (typeof epics)[number]) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      taskCount: totalByEpic.get(e.id) ?? 0,
      doneCount: doneByEpic.get(e.id) ?? 0,
    });

    return {
      domains: domains.map((d) => ({
        id: d.id,
        title: d.title,
        epics: epics.filter((e) => e.parentId === d.id).map(epicView),
      })),
      orphanEpics: epics.filter((e) => e.parentId === null).map(epicView),
    };
  }

  /**
   * Resolve a human-readable issue key like `PM-123` to its row, scoped
   * to projects the user can read. Returns null if the project key is
   * unknown, the issue number is missing in that project, or the user
   * isn't a member of the project (no leak of titles across tenants).
   * Backs the markdown auto-link feature (PM-77).
   */
  async resolveKey(
    userId: string,
    key: string,
  ): Promise<{
    projectId: string;
    projectKey: string;
    issueId: string;
    issueNumber: number;
    title: string;
  } | null> {
    const match = key.match(/^([A-Z]{2,8})-(\d{1,6})$/);
    if (!match) return null;
    const [, projectKey, numStr] = match;
    const issueNumber = Number(numStr);

    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true },
    });
    if (!project) return null;

    // Membership check via either project member or workspace superuser.
    const [member, user] = await Promise.all([
      this.prisma.projectMember.findFirst({
        where: { projectId: project.id, userId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { isSuperuser: true },
      }),
    ]);
    if (!member && !user?.isSuperuser) return null;

    const issue = await this.prisma.issue.findFirst({
      where: { projectId: project.id, number: issueNumber },
      select: { id: true, number: true, title: true },
    });
    if (!issue) return null;

    return {
      projectId: project.id,
      projectKey: project.key,
      issueId: issue.id,
      issueNumber: issue.number,
      title: issue.title,
    };
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
