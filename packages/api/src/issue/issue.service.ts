import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateIssueDto } from './dto/create-issue.dto.js';
import type { UpdateIssueDto } from './dto/update-issue.dto.js';
import type { QueryIssueDto } from './dto/query-issue.dto.js';
import type { BulkUpdateIssueDto } from './dto/bulk-update-issue.dto.js';
import type { BulkDeleteIssueDto } from './dto/bulk-delete-issue.dto.js';
import type { IssueWhereInput } from '../../generated/prisma/models.js';
import type { IssueStatus } from '../../generated/prisma/enums.js';
import { IssueType } from '../../generated/prisma/enums.js';
import { USER_SELECT, ISSUE_MAX_PER_COLUMN } from '../common/constants.js';
import { NotificationService } from '../notification/notification.service.js';

const ORDER_GAP = 1000;

const issueInclude = {
  assignee: { select: USER_SELECT },
  creator: { select: USER_SELECT },
  labels: { include: { label: true } },
  components: { include: { component: true } },
  parent: { select: { id: true, number: true, title: true } },
  _count: { select: { children: true } },
} as const;

@Injectable()
export class IssueService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  private static readonly TRACKED_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'type',
    'assigneeId',
    'parentId',
    'dueDate',
    'focusDate',
  ] as const;

  private buildActivities(
    existing: Record<string, unknown>,
    updates: Record<string, unknown>,
  ): { field: string; oldValue: string | null; newValue: string | null }[] {
    const activities: {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];
    for (const key of IssueService.TRACKED_FIELDS) {
      const value = updates[key];
      if (value === undefined) continue;
      const oldStr = existing[key] != null ? String(existing[key]) : null;
      const newStr = value != null ? String(value) : null;
      if (newStr !== oldStr) {
        activities.push({ field: key, oldValue: oldStr, newValue: newStr });
      }
    }
    return activities;
  }

  private notifyAssignment(params: {
    projectKey: string;
    issueNumber: number;
    issueTitle: string;
    issueId: string;
    projectId: string;
    newAssigneeId: string;
    actorId: string;
  }) {
    this.notificationService
      .create({
        type: 'ASSIGNED',
        message: `${params.projectKey}-${params.issueNumber} "${params.issueTitle}" has been assigned to you`,
        userId: params.newAssigneeId,
        issueId: params.issueId,
        projectId: params.projectId,
        actorId: params.actorId,
      })
      .catch(() => {});
  }

  /** Auto-assign unassigned children when parent assignee changes (1-level only) */
  private async autoAssignUnassignedChildren(
    parentId: string,
    assigneeId: string,
    projectKey: string,
    projectId: string,
    actorId: string,
  ) {
    const unassignedChildren = await this.prisma.issue.findMany({
      where: { parentId, assigneeId: null },
      select: { id: true, number: true, title: true },
    });
    if (unassignedChildren.length === 0) return;

    await this.prisma.$transaction([
      this.prisma.issue.updateMany({
        where: { id: { in: unassignedChildren.map((c) => c.id) } },
        data: { assigneeId },
      }),
      this.prisma.activity.createMany({
        data: unassignedChildren.map((c) => ({
          issueId: c.id,
          userId: actorId,
          field: 'assigneeId',
          oldValue: null,
          newValue: assigneeId,
        })),
      }),
    ]);

    for (const child of unassignedChildren) {
      this.notifyAssignment({
        projectKey,
        issueNumber: child.number,
        issueTitle: child.title,
        issueId: child.id,
        projectId,
        newAssigneeId: assigneeId,
        actorId,
      });
    }
  }

  private async validateHierarchy(
    type: string | undefined,
    parentId: string | null | undefined,
    issueId?: string,
  ) {
    // EPIC cannot have a parent
    if (type === IssueType.EPIC && parentId) {
      throw new BadRequestException('EPIC cannot have a parent issue');
    }

    // SUB_TASK must have a parent (only enforced when we know the type definitively)
    if (type === IssueType.SUB_TASK && !parentId) {
      throw new BadRequestException('SUB_TASK must have a parent issue');
    }

    if (parentId) {
      // Cannot be own parent
      if (issueId && parentId === issueId) {
        throw new BadRequestException('Issue cannot be its own parent');
      }

      const parent = await this.prisma.issue.findUnique({
        where: { id: parentId },
        select: { id: true, type: true, parentId: true },
      });

      if (!parent) {
        throw new BadRequestException('Parent issue not found');
      }

      // A SUB_TASK's parent cannot be another SUB_TASK
      if (parent.type === IssueType.SUB_TASK) {
        throw new BadRequestException(
          'A SUB_TASK cannot be the parent of another issue',
        );
      }

      // Walk up the parent chain to detect cycles (only relevant during update)
      if (issueId) {
        let currentId = parent.parentId;
        while (currentId) {
          if (currentId === issueId) {
            throw new BadRequestException('Circular parent reference detected');
          }
          const ancestor = await this.prisma.issue.findUnique({
            where: { id: currentId },
            select: { parentId: true },
          });
          currentId = ancestor?.parentId ?? null;
        }
      }
    }
  }

  async create(projectId: string, dto: CreateIssueDto, creatorId: string) {
    const { labelIds, componentIds, ...data } = dto;

    await this.validateHierarchy(data.type, data.parentId);

    // Auto-assign from component default assignee if no assignee specified
    let effectiveAssigneeId = data.assigneeId;
    if (!effectiveAssigneeId && componentIds?.length) {
      const components = await this.prisma.component.findMany({
        where: { id: { in: componentIds }, projectId },
        select: { defaultAssigneeId: true },
      });
      const defaultAssignee = components.find((c) => c.defaultAssigneeId);
      if (defaultAssignee) {
        effectiveAssigneeId = defaultAssignee.defaultAssigneeId!;
      }
    }

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
          assigneeId: effectiveAssigneeId,
          number,
          order,
          projectId,
          creatorId,
          ...(labelIds?.length && {
            labels: {
              create: labelIds.map((labelId) => ({ labelId })),
            },
          }),
          ...(componentIds?.length && {
            components: {
              create: componentIds.map((componentId) => ({ componentId })),
            },
          }),
        },
        include: issueInclude,
      });

      // Create "created" activity log
      await tx.activity.create({
        data: {
          field: 'created',
          oldValue: null,
          newValue: null,
          issueId: issue.id,
          userId: creatorId,
        },
      });

      return issue;
    });
  }

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

    const where: IssueWhereInput = {
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
        include: issueInclude,
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

  async findByStatus(projectId: string, includeArchived = false) {
    // Kanban board: group issues by status with a per-column limit to prevent
    // performance issues on projects with many completed/canceled issues.
    const MAX_PER_COLUMN = ISSUE_MAX_PER_COLUMN;

    const statuses: IssueStatus[] = [
      'BACKLOG' as IssueStatus,
      'TODO' as IssueStatus,
      'IN_PROGRESS' as IssueStatus,
      'REVIEW_QA' as IssueStatus,
      'DONE' as IssueStatus,
      'CANCELED' as IssueStatus,
    ];

    const grouped: Record<
      string,
      Awaited<ReturnType<typeof this.prisma.issue.findMany>>
    > = {};

    await Promise.all(
      statuses.map(async (status) => {
        const issues = await this.prisma.issue.findMany({
          where: {
            projectId,
            status,
            ...(!includeArchived && { archivedAt: null }),
          },
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
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
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
        specLinks: {
          include: {
            spec: {
              select: { id: true, title: true, status: true, category: true },
            },
          },
          orderBy: { createdAt: 'desc' },
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

    const { labelIds, componentIds, ...data } = dto;

    // Convert date strings to Date objects for Prisma
    if (data.dueDate !== undefined) {
      (data as Record<string, unknown>).dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.focusDate !== undefined) {
      (data as Record<string, unknown>).focusDate = data.focusDate ? new Date(data.focusDate) : null;
    }

    // Validate hierarchy when type or parentId is being changed
    if (data.type !== undefined || data.parentId !== undefined) {
      const effectiveType = data.type ?? existing.type;
      const effectiveParentId =
        data.parentId !== undefined ? data.parentId : existing.parentId;
      await this.validateHierarchy(effectiveType, effectiveParentId, issueId);
    }

    // Track changes for activity log
    const activities = this.buildActivities(
      existing as unknown as Record<string, unknown>,
      data as unknown as Record<string, unknown>,
    );

    // Reset archivedAt when status changes away from DONE/CANCELED
    const archiveReset =
      data.status &&
      data.status !== existing.status &&
      !['DONE', 'CANCELED'].includes(data.status) &&
      existing.archivedAt
        ? { archivedAt: null }
        : {};

    // Auto-set isRecheck when moving back to IN_PROGRESS from a later stage
    // Reset isRecheck when moving away from IN_PROGRESS
    const LATER_STAGES = ['REVIEW_QA', 'DONE', 'CANCELED'];
    const recheckUpdate =
      data.status && data.status !== existing.status
        ? data.status === 'IN_PROGRESS' && LATER_STAGES.includes(existing.status)
          ? { isRecheck: true }
          : data.status !== 'IN_PROGRESS' && existing.isRecheck
            ? { isRecheck: false }
            : {}
        : {};

    const issue = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        ...data,
        ...archiveReset,
        ...recheckUpdate,
        ...(labelIds !== undefined && {
          labels: {
            deleteMany: {},
            create: labelIds.map((labelId) => ({ labelId })),
          },
        }),
        ...(componentIds !== undefined && {
          components: {
            deleteMany: {},
            create: componentIds.map((componentId) => ({ componentId })),
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

    // Notify new assignee + auto-assign unassigned children
    if (
      data.assigneeId !== undefined &&
      data.assigneeId !== existing.assigneeId &&
      data.assigneeId
    ) {
      const newAssigneeId = data.assigneeId;
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { key: true },
      });
      const projectKey = project?.key ?? '';

      this.notifyAssignment({
        projectKey,
        issueNumber: existing.number,
        issueTitle: existing.title,
        issueId,
        projectId,
        newAssigneeId,
        actorId: userId,
      });

      await this.autoAssignUnassignedChildren(
        issueId,
        newAssigneeId,
        projectKey,
        projectId,
        userId,
      );
    }

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

    const activities: {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    if (existing.status !== targetStatus) {
      activities.push({
        field: 'status',
        oldValue: existing.status,
        newValue: targetStatus,
      });
    }

    // Reset archivedAt when dragging to a non-DONE/CANCELED column
    const archiveReset =
      existing.archivedAt && !['DONE', 'CANCELED'].includes(targetStatus)
        ? { archivedAt: null }
        : {};

    // Auto-set isRecheck when dragging back to IN_PROGRESS from a later stage
    const LATER_STAGES = ['REVIEW_QA', 'DONE', 'CANCELED'];
    const recheckUpdate =
      existing.status !== targetStatus
        ? targetStatus === 'IN_PROGRESS' && LATER_STAGES.includes(existing.status)
          ? { isRecheck: true }
          : targetStatus !== 'IN_PROGRESS' && existing.isRecheck
            ? { isRecheck: false }
            : {}
        : {};

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issueId },
        data: {
          status: targetStatus as IssueStatus,
          order: targetOrder,
          ...archiveReset,
          ...recheckUpdate,
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

  async bulkUpdate(projectId: string, dto: BulkUpdateIssueDto, userId: string) {
    const { issueIds, ...updates } = dto;

    // Verify all issues belong to this project
    const issues = await this.prisma.issue.findMany({
      where: { id: { in: issueIds }, projectId },
      select: {
        id: true,
        status: true,
        priority: true,
        assigneeId: true,
        number: true,
        title: true,
      },
    });

    if (issues.length === 0) {
      throw new NotFoundException('No matching issues found');
    }

    if (issues.length !== issueIds.length) {
      throw new BadRequestException(
        `${issueIds.length - issues.length} issue(s) not found in this project`,
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const issue of issues) {
        const activities = this.buildActivities(
          issue as unknown as Record<string, unknown>,
          updates as unknown as Record<string, unknown>,
        );

        if (activities.length === 0) continue;

        await tx.issue.update({
          where: { id: issue.id },
          data: {
            ...(updates.status !== undefined && { status: updates.status }),
            ...(updates.priority !== undefined && {
              priority: updates.priority,
            }),
            ...(updates.assigneeId !== undefined && {
              assigneeId: updates.assigneeId,
            }),
            activities: {
              create: activities.map((a) => ({ ...a, userId })),
            },
          },
        });

        // Notify new assignee
        if (updates.assigneeId && updates.assigneeId !== issue.assigneeId) {
          this.notifyAssignment({
            projectKey: project?.key ?? '',
            issueNumber: issue.number,
            issueTitle: issue.title,
            issueId: issue.id,
            projectId,
            newAssigneeId: updates.assigneeId,
            actorId: userId,
          });
        }
      }
    });

    return { updated: issues.length };
  }

  async bulkDelete(projectId: string, dto: BulkDeleteIssueDto) {
    const result = await this.prisma.issue.deleteMany({
      where: { id: { in: dto.issueIds }, projectId },
    });

    return { deleted: result.count };
  }
}
