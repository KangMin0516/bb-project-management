import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISSUE_REPOSITORY,
  type ActivityRowToWrite,
  type IssueRepository,
  type IssueStatusLiteral,
} from './ports/issue.repository.js';

const LATER_STAGES: ReadonlySet<IssueStatusLiteral> = new Set([
  'REVIEW_QA',
  'RECHECK',
  'DONE',
  'CANCELED',
]);
const TERMINAL_STATUSES: ReadonlySet<IssueStatusLiteral> = new Set([
  'DONE',
  'CANCELED',
]);

export interface ReorderIssueCommand {
  projectId: string;
  issueId: string;
  targetStatus: IssueStatusLiteral;
  targetOrder: number;
  actorId: string;
}

/**
 * Drag-drop kanban reorder. Behaviour preservation (checklist §2.3):
 *  - I-R1 sparse `order` field with renormalization on collision
 *  - I-R2 cross-status status activity row (status field only)
 *  - I-R3 archive reset when dragging out of DONE/CANCELED
 *  - I-R3b isRecheck transition logic (mirrors Update)
 *  - I-R4 no notification side effects (assignee unchanged)
 */
@Injectable()
export class ReorderIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
  ) {}

  async execute(cmd: ReorderIssueCommand): Promise<unknown> {
    const targetOrder = Number.isFinite(cmd.targetOrder)
      ? Math.max(0, Math.round(cmd.targetOrder))
      : 0;
    const existing = await this.repo.findForUpdate(cmd.issueId);
    if (!existing || existing.projectId !== cmd.projectId) {
      throw new NotFoundException('Issue not found');
    }

    const activities: ActivityRowToWrite[] = [];
    if (existing.status !== cmd.targetStatus) {
      activities.push({
        field: 'status',
        oldValue: existing.status,
        newValue: cmd.targetStatus,
      });
    }

    // Reset archivedAt when leaving DONE/CANCELED to an active column.
    const resetArchive =
      existing.archivedAt !== null && !TERMINAL_STATUSES.has(cmd.targetStatus);

    // isRecheck transitions — same rules as Update.
    let recheckUpdate: boolean | undefined;
    if (existing.status !== cmd.targetStatus) {
      if (
        cmd.targetStatus === 'IN_PROGRESS' &&
        LATER_STAGES.has(existing.status)
      ) {
        recheckUpdate = true;
      } else if (cmd.targetStatus !== 'IN_PROGRESS' && existing.isRecheck) {
        recheckUpdate = false;
      }
    }

    return this.repo.reorderInTransaction({
      projectId: cmd.projectId,
      issueId: cmd.issueId,
      targetStatus: cmd.targetStatus,
      targetOrder,
      resetArchive,
      recheckUpdate,
      activities,
      actorId: cmd.actorId,
    });
  }
}
