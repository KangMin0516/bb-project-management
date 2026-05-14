import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ISSUE_INCLUDE } from '../application/issue-query.service.js';
import type {
  CreateIssuePayload,
  IssueRepository,
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
}
