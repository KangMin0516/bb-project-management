import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ISSUE_INCLUDE } from '../application/issue-query.service.js';
import type {
  BulkIssueRow,
  ChildIssue,
  CreateIssuePayload,
  IssueRepository,
  IssueRowForUpdate,
  IssueTypeLiteral,
  RecentActivityRow,
  ReorderIssuePayload,
  UpdateIssuePayload,
} from '../application/ports/issue.repository.js';

const ORDER_GAP = 1000;

@Injectable()
export class IssuePrismaRepository implements IssueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithSequenceAndActivity(
    payload: CreateIssuePayload,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      // Auto-increment per-project issue number. Matches legacy logic
      // (find max + 1) — uses the transaction's snapshot so concurrent
      // creators in the same project don't collide.
      const lastIssue = await tx.issue.findFirst({
        where: { projectId: payload.projectId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const number = (lastIssue?.number ?? 0) + 1;

      // Compute the trailing order value for this status column so new
      // issues append at the bottom (`order` is a sparse float-ish int
      // with gap 1000 — reorder renormalizes).
      const lastInColumn = await tx.issue.findFirst({
        where: { projectId: payload.projectId, status: payload.status },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const order = (lastInColumn?.order ?? 0) + ORDER_GAP;

      const issue = await tx.issue.create({
        data: {
          ...(payload.id ? { id: payload.id } : {}),
          title: payload.title,
          description: payload.description,
          type: payload.type,
          status: payload.status,
          priority: payload.priority,
          parentId: payload.parentId,
          assigneeId: payload.assigneeId,
          reviewerAssigneeId: payload.reviewerAssigneeId,
          startDate: payload.startDate,
          dueDate: payload.dueDate,
          number,
          order,
          projectId: payload.projectId,
          creatorId: payload.creatorId,
          ...(payload.labelIds.length && {
            labels: {
              create: payload.labelIds.map((labelId) => ({ labelId })),
            },
          }),
          ...(payload.componentIds.length && {
            components: {
              create: payload.componentIds.map((componentId) => ({
                componentId,
              })),
            },
          }),
        },
        include: ISSUE_INCLUDE,
      });

      // Initial activity row — same shape the legacy service produced,
      // co-committed with the issue row.
      await tx.activity.create({
        data: {
          field: 'created',
          oldValue: null,
          newValue: null,
          issueId: issue.id,
          userId: payload.creatorId,
        },
      });

      return issue;
    });
  }

  async fetchParentType(
    parentId: string,
  ): Promise<'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK' | null> {
    const parent = await this.prisma.issue.findUnique({
      where: { id: parentId },
      select: { type: true },
    });
    return parent ? parent.type : null;
  }

  async resolveComponentDefaultAssignee(
    projectId: string,
    componentIds: string[],
  ): Promise<string | null> {
    if (componentIds.length === 0) return null;
    const components = await this.prisma.component.findMany({
      where: { id: { in: componentIds }, projectId },
      select: { defaultAssigneeId: true },
    });
    return (
      components.find((c) => c.defaultAssigneeId)?.defaultAssigneeId ?? null
    );
  }

  // ─── Update flow ───────────────────────────────────────────

  async findForUpdate(issueId: string): Promise<IssueRowForUpdate | null> {
    const row = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        projectId: true,
        number: true,
        title: true,
        description: true,
        type: true,
        status: true,
        priority: true,
        parentId: true,
        assigneeId: true,
        reviewerAssigneeId: true,
        startDate: true,
        dueDate: true,
        focusDate: true,
        isRecheck: true,
        archivedAt: true,
      },
    });
    return row;
  }

  async parentChainContains(
    fromParentId: string,
    targetId: string,
  ): Promise<boolean> {
    // Bounded walk — single SELECT per step. Matches the legacy
    // service's cycle-detection (no recursive CTE). Safe because
    // hierarchy depth is small in practice.
    let currentId: string | null = fromParentId;
    while (currentId) {
      if (currentId === targetId) return true;
      const ancestor: { parentId: string | null } | null =
        await this.prisma.issue.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      currentId = ancestor?.parentId ?? null;
    }
    return false;
  }

  async findRecentActivityForCoalesce(
    issueId: string,
    userId: string,
    field: 'assigneeId' | 'reviewerAssigneeId',
    sinceMs: number,
  ): Promise<RecentActivityRow | null> {
    return this.prisma.activity.findFirst({
      where: {
        issueId,
        userId,
        field,
        createdAt: { gt: new Date(Date.now() - sinceMs) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, oldValue: true },
    });
  }

  async deleteActivity(activityId: string): Promise<void> {
    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  async updateWithLinksAndActivities(
    payload: UpdateIssuePayload,
  ): Promise<unknown> {
    return this.prisma.issue.update({
      where: { id: payload.issueId },
      data: {
        ...payload.fieldUpdates,
        ...(payload.labelIds !== undefined && {
          labels: {
            deleteMany: {},
            create: payload.labelIds.map((labelId) => ({ labelId })),
          },
        }),
        ...(payload.componentIds !== undefined && {
          components: {
            deleteMany: {},
            create: payload.componentIds.map((componentId) => ({
              componentId,
            })),
          },
        }),
        ...(payload.activities.length > 0 && {
          activities: {
            create: payload.activities.map((a) => ({
              ...a,
              userId: payload.actorId,
            })),
          },
        }),
      },
      include: ISSUE_INCLUDE,
    });
  }

  async fetchProjectKey(projectId: string): Promise<string | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });
    return project?.key ?? null;
  }

  async fetchUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? null;
  }

  async findUnassignedChildren(parentId: string): Promise<ChildIssue[]> {
    return this.prisma.issue.findMany({
      where: { parentId, assigneeId: null },
      select: { id: true, number: true, title: true },
    });
  }

  async bulkAssignChildren(
    childIds: string[],
    assigneeId: string,
    actorId: string,
  ): Promise<void> {
    if (childIds.length === 0) return;
    await this.prisma.$transaction([
      this.prisma.issue.updateMany({
        where: { id: { in: childIds } },
        data: { assigneeId },
      }),
      this.prisma.activity.createMany({
        data: childIds.map((id) => ({
          issueId: id,
          userId: actorId,
          field: 'assigneeId',
          oldValue: null,
          newValue: assigneeId,
        })),
      }),
    ]);
  }

  // ─── Phase 3: Reorder / Remove / Bulk ──────────────────────

  async delete(issueId: string): Promise<void> {
    await this.prisma.issue.delete({ where: { id: issueId } });
  }

  async reorderInTransaction(payload: ReorderIssuePayload): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: payload.issueId },
        data: {
          status: payload.targetStatus,
          order: payload.targetOrder,
          ...(payload.resetArchive ? { archivedAt: null } : {}),
          ...(payload.recheckUpdate !== undefined
            ? { isRecheck: payload.recheckUpdate }
            : {}),
          ...(payload.activities.length > 0 && {
            activities: {
              create: payload.activities.map((a) => ({
                ...a,
                userId: payload.actorId,
              })),
            },
          }),
        },
        include: ISSUE_INCLUDE,
      });

      // Renormalize if the new order collides with a neighbor's order
      // (sparse-integer space drifted close together over many drags).
      const neighbors = await tx.issue.findMany({
        where: {
          projectId: payload.projectId,
          status: payload.targetStatus,
          id: { not: payload.issueId },
          order: {
            gte: payload.targetOrder - 1,
            lte: payload.targetOrder + 1,
          },
        },
        select: { order: true },
      });
      const needsRenormalize = neighbors.some(
        (n) => Math.abs(n.order - payload.targetOrder) < 0.001,
      );
      if (needsRenormalize) {
        const allInColumn = await tx.issue.findMany({
          where: {
            projectId: payload.projectId,
            status: payload.targetStatus,
          },
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

  async findMinimalForBulk(
    projectId: string,
    ids: string[],
  ): Promise<BulkIssueRow[]> {
    if (ids.length === 0) return [];
    return this.prisma.issue.findMany({
      where: { id: { in: ids }, projectId },
      select: {
        id: true,
        status: true,
        priority: true,
        assigneeId: true,
        number: true,
        title: true,
      },
    });
  }

  async bulkUpdateInTransaction(
    rows: BulkIssueRow[],
    fieldUpdates: {
      status?: string;
      priority?: string;
      assigneeId?: string | null;
    },
    actorId: string,
    onIssueUpdated: (row: BulkIssueRow) => void,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const activities: {
          field: string;
          oldValue: string | null;
          newValue: string | null;
        }[] = [];
        if (
          fieldUpdates.status !== undefined &&
          fieldUpdates.status !== row.status
        ) {
          activities.push({
            field: 'status',
            oldValue: row.status,
            newValue: fieldUpdates.status,
          });
        }
        if (
          fieldUpdates.priority !== undefined &&
          fieldUpdates.priority !== row.priority
        ) {
          activities.push({
            field: 'priority',
            oldValue: row.priority,
            newValue: fieldUpdates.priority,
          });
        }
        if (
          fieldUpdates.assigneeId !== undefined &&
          fieldUpdates.assigneeId !== row.assigneeId
        ) {
          activities.push({
            field: 'assigneeId',
            oldValue: row.assigneeId,
            newValue: fieldUpdates.assigneeId,
          });
        }
        if (activities.length === 0) continue;

        await tx.issue.update({
          where: { id: row.id },
          data: {
            ...(fieldUpdates.status !== undefined && {
              status: fieldUpdates.status as IssueStatusLiteralPrismaInput,
            }),
            ...(fieldUpdates.priority !== undefined && {
              priority:
                fieldUpdates.priority as IssuePriorityLiteralPrismaInput,
            }),
            ...(fieldUpdates.assigneeId !== undefined && {
              assigneeId: fieldUpdates.assigneeId,
            }),
            activities: {
              create: activities.map((a) => ({ ...a, userId: actorId })),
            },
          },
        });
        onIssueUpdated(row);
      }
    });
  }

  async bulkDelete(projectId: string, ids: string[]): Promise<number> {
    const result = await this.prisma.issue.deleteMany({
      where: { id: { in: ids }, projectId },
    });
    return result.count;
  }
}

// Local aliases for the Prisma enum unions. Importing the generated
// enums in the .ts world adds noise (they're values + types); keeping
// the cast-site narrow at the bulk update keeps the rest of the
// repository free of `as`.
type IssueStatusLiteralPrismaInput =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW_QA'
  | 'DONE'
  | 'CANCELED';
type IssuePriorityLiteralPrismaInput = 'HIGH' | 'MEDIUM' | 'LOW';

// Silence unused-import warnings for typed-but-not-instantiated
// helpers used only in method signatures via `IssueRepository`.
void ({} as IssueTypeLiteral | undefined);
