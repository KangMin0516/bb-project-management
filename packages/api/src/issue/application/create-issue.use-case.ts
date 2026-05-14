import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IssueType,
  type IssuePriority,
  type IssueStatus,
} from '../../../generated/prisma/enums.js';
import { validateTypeWithParent } from '../domain/issue-type.vo.js';
import {
  ISSUE_REPOSITORY,
  type IssueRepository,
} from './ports/issue.repository.js';

export interface CreateIssueCommand {
  projectId: string;
  creatorId: string;
  title: string;
  description?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  parentId?: string;
  assigneeId?: string;
  reviewerAssigneeId?: string;
  startDate?: string;
  dueDate?: string;
  labelIds?: string[];
  componentIds?: string[];
}

/**
 * Create a new issue. Mirrors the legacy IssueService.create flow
 * (behaviour-preservation-checklist §2.1 I-C1..I-C10) but split
 * across layers:
 *  - Hierarchy invariants run in the domain (`validateTypeWithParent`)
 *    after a parent-type lookup through the repository.
 *  - Auto-fill from component default assignee lives here in
 *    orchestration (cross-aggregate concern).
 *  - Number + order computation + nested label/component link +
 *    initial activity row are persistence concerns, all inside one
 *    `$transaction` in the repository.
 *
 * The use case does NOT trigger a Slack DM at create time. The legacy
 * service intentionally skipped notifyAssignment on create, and
 * `Issue.create()` only emits an `IssueCreatedEvent` (no
 * `IssueAssignedEvent`) — kept identical to avoid an unintended
 * "notification on first assign" behaviour change.
 */
@Injectable()
export class CreateIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
  ) {}

  async execute(cmd: CreateIssueCommand): Promise<unknown> {
    const type = cmd.type ?? IssueType.TASK;
    const parentId = cmd.parentId ?? null;

    let parentType: 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK' | null = null;
    if (parentId) {
      parentType = await this.repo.fetchParentType(parentId);
      if (!parentType) {
        throw new BadRequestException('Parent issue not found');
      }
    }

    const hierarchyErr = validateTypeWithParent(type, parentId, parentType);
    if (hierarchyErr) {
      // Legacy threw BadRequestException with a hand-rolled message; keep
      // the same shape via the domain's error codes.
      throw new BadRequestException(hierarchyMessage(hierarchyErr));
    }

    // I-C4: auto-fill assignee from a component's defaultAssigneeId
    // when none is provided. Order-of-precedence matches the legacy
    // implementation (.find — first matching component wins).
    let effectiveAssigneeId = cmd.assigneeId ?? null;
    if (!effectiveAssigneeId && cmd.componentIds?.length) {
      effectiveAssigneeId = await this.repo.resolveComponentDefaultAssignee(
        cmd.projectId,
        cmd.componentIds,
      );
    }

    try {
      return await this.repo.createWithSequenceAndActivity({
        projectId: cmd.projectId,
        creatorId: cmd.creatorId,
        title: cmd.title,
        description: cmd.description ?? null,
        type,
        status: cmd.status ?? 'BACKLOG',
        priority: cmd.priority ?? 'MEDIUM',
        parentId,
        assigneeId: effectiveAssigneeId,
        reviewerAssigneeId: cmd.reviewerAssigneeId ?? null,
        startDate: cmd.startDate ? new Date(cmd.startDate) : null,
        dueDate: cmd.dueDate ? new Date(cmd.dueDate) : null,
        labelIds: cmd.labelIds ?? [],
        componentIds: cmd.componentIds ?? [],
      });
    } catch (err) {
      // Prisma raises P2025 ("record not found") when a foreign key
      // reference (assignee, label, component, parent) doesn't exist.
      // The global filter maps to 404, but legacy callers expected 400
      // for "referenced entity missing". Re-shape selectively.
      if (isPrismaForeignKeyMiss(err)) {
        throw new NotFoundException('Referenced record does not exist');
      }
      throw err;
    }
  }
}

function hierarchyMessage(
  code:
    | 'EPIC_CANNOT_HAVE_PARENT'
    | 'SUB_TASK_REQUIRES_PARENT'
    | 'PARENT_CANNOT_BE_SUB_TASK'
    | 'CANNOT_BE_OWN_PARENT',
): string {
  switch (code) {
    case 'EPIC_CANNOT_HAVE_PARENT':
      return 'EPIC cannot have a parent issue';
    case 'SUB_TASK_REQUIRES_PARENT':
      return 'SUB_TASK must have a parent issue';
    case 'PARENT_CANNOT_BE_SUB_TASK':
      return 'A SUB_TASK cannot be the parent of another issue';
    case 'CANNOT_BE_OWN_PARENT':
      return 'Issue cannot be its own parent';
  }
}

function isPrismaForeignKeyMiss(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === 'P2025';
}
