import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../../notification/notification.service.js';
import { validateTypeWithParent } from '../domain/issue-type.vo.js';
import {
  ISSUE_REPOSITORY,
  type ActivityRowToWrite,
  type IssuePriorityLiteral,
  type IssueRepository,
  type IssueRowForUpdate,
  type IssueStatusLiteral,
  type IssueTypeLiteral,
} from './ports/issue.repository.js';

/** Mirrors the legacy IssueService coalesce window. */
const ASSIGNEE_ACTIVITY_COALESCE_MS = 10_000;

const TRACKED_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'type',
  'assigneeId',
  'reviewerAssigneeId',
  'parentId',
  'startDate',
  'dueDate',
  'focusDate',
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

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

export interface UpdateIssueCommand {
  projectId: string;
  issueId: string;
  actorId: string;
  /** Field changes. Undefined keys are skipped; explicit `null` clears. */
  changes: {
    title?: string;
    description?: string | null;
    status?: IssueStatusLiteral;
    priority?: IssuePriorityLiteral;
    type?: IssueTypeLiteral;
    assigneeId?: string | null;
    reviewerAssigneeId?: string | null;
    parentId?: string | null;
    order?: number;
    startDate?: string | null;
    dueDate?: string | null;
    focusDate?: string | null;
    isRecheck?: boolean;
    labelIds?: string[];
    componentIds?: string[];
  };
  /** When true, skip assignee/reviewer Slack DM scheduling — also
   *  cancels any pending DM (legacy Undo flow). */
  silent?: boolean;
}

/**
 * Update an issue. Mirrors the legacy IssueService.update flow
 * (behaviour-preservation-checklist §2.2 I-U1..I-U12):
 *  1. fetch existing row
 *  2. validate hierarchy when type / parentId change (with cycle detect)
 *  3. build activities diff over tracked fields
 *  4. coalesce rapid assignee / reviewer clicks in the 10 s window
 *  5. archive reset when leaving DONE/CANCELED
 *  6. isRecheck auto-set / reset on status transitions
 *  7. atomic update + nested label/component/activity create
 *  8. schedule assignee DM (with silent / net-no-op handling)
 *  9. auto-assign unassigned children if EPIC assignee changed
 * 10. schedule reviewer DM (no cascade)
 */
@Injectable()
export class UpdateIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
    private readonly notifications: NotificationService,
  ) {}

  async execute(cmd: UpdateIssueCommand): Promise<unknown> {
    const existing = await this.repo.findForUpdate(cmd.issueId);
    if (!existing || existing.projectId !== cmd.projectId) {
      throw new NotFoundException('Issue not found');
    }

    const c = cmd.changes;

    // 1. Hierarchy: validate type+parent + cycle detect.
    if (c.type !== undefined || c.parentId !== undefined) {
      const effectiveType: IssueTypeLiteral = c.type ?? existing.type;
      const effectiveParentId: string | null =
        c.parentId !== undefined ? c.parentId : existing.parentId;
      await this.assertHierarchyOk(
        effectiveType,
        effectiveParentId,
        cmd.issueId,
      );
    }

    // 2. Build field updates + activity diff (over the tracked subset).
    const fieldUpdates = this.buildFieldUpdates(c);
    const activities = this.buildActivities(existing, fieldUpdates);

    // 3. Coalesce rapid clicks on assignee / reviewer fields.
    const assigneeIsNetNoop = await this.coalesceField(
      activities,
      'assigneeId',
      cmd.issueId,
      cmd.actorId,
    );
    const reviewerIsNetNoop = await this.coalesceField(
      activities,
      'reviewerAssigneeId',
      cmd.issueId,
      cmd.actorId,
    );

    // 4. Archive reset — moving out of DONE/CANCELED clears archivedAt.
    if (
      c.status &&
      c.status !== existing.status &&
      !TERMINAL_STATUSES.has(c.status) &&
      existing.archivedAt
    ) {
      fieldUpdates.archivedAt = null;
    }

    // 5. isRecheck transition logic.
    if (c.status && c.status !== existing.status) {
      if (c.status === 'IN_PROGRESS' && LATER_STAGES.has(existing.status)) {
        fieldUpdates.isRecheck = true;
      } else if (c.status !== 'IN_PROGRESS' && existing.isRecheck) {
        fieldUpdates.isRecheck = false;
      }
    }

    // 6. Atomic persist (update + nested label/component/activity).
    const issue = await this.repo.updateWithLinksAndActivities({
      issueId: cmd.issueId,
      fieldUpdates,
      labelIds: c.labelIds,
      componentIds: c.componentIds,
      activities,
      actorId: cmd.actorId,
    });

    // 7. Side effects — assignee + reviewer notifications.
    if (
      c.assigneeId !== undefined &&
      c.assigneeId !== existing.assigneeId &&
      c.assigneeId
    ) {
      const effectiveSilent = cmd.silent === true || assigneeIsNetNoop;
      await this.scheduleNotification(existing, cmd, c.assigneeId, {
        kind: 'ASSIGNED',
        silent: effectiveSilent,
      });
      if (!effectiveSilent) {
        await this.cascadeAutoAssignChildren(
          existing,
          c.assigneeId,
          cmd.actorId,
        );
      }
    }

    if (
      c.reviewerAssigneeId !== undefined &&
      c.reviewerAssigneeId !== existing.reviewerAssigneeId &&
      c.reviewerAssigneeId
    ) {
      await this.scheduleNotification(existing, cmd, c.reviewerAssigneeId, {
        kind: 'REVIEWER_ASSIGNED',
        silent: cmd.silent === true || reviewerIsNetNoop,
      });
    }

    return issue;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async assertHierarchyOk(
    type: IssueTypeLiteral,
    parentId: string | null,
    issueId: string,
  ): Promise<void> {
    if (parentId === issueId) {
      throw new BadRequestException('Issue cannot be its own parent');
    }
    let parentType: IssueTypeLiteral | null = null;
    if (parentId) {
      parentType = await this.repo.fetchParentType(parentId);
      if (!parentType) {
        throw new BadRequestException('Parent issue not found');
      }
    }
    const err = validateTypeWithParent(type, parentId, parentType, issueId);
    if (err) {
      throw new BadRequestException(hierarchyMessage(err));
    }
    // Cycle: walk the new parent's chain and reject if it loops back.
    if (parentId) {
      const hasCycle = await this.repo.parentChainContains(parentId, issueId);
      if (hasCycle) {
        throw new BadRequestException('Circular parent reference detected');
      }
    }
  }

  /**
   * Translate the command's `changes` (which carries Dto-ish ISO date
   * strings) into the Prisma-shaped `data` payload (Date instances,
   * etc.). Only sets keys present in `changes` — `undefined` means
   * "leave alone".
   */
  private buildFieldUpdates(c: UpdateIssueCommand['changes']) {
    const out: Record<string, unknown> = {};
    if (c.title !== undefined) out.title = c.title;
    if (c.description !== undefined) out.description = c.description;
    if (c.status !== undefined) out.status = c.status;
    if (c.priority !== undefined) out.priority = c.priority;
    if (c.type !== undefined) out.type = c.type;
    if (c.assigneeId !== undefined) out.assigneeId = c.assigneeId;
    if (c.reviewerAssigneeId !== undefined)
      out.reviewerAssigneeId = c.reviewerAssigneeId;
    if (c.parentId !== undefined) out.parentId = c.parentId;
    if (c.order !== undefined) out.order = c.order;
    if (c.startDate !== undefined)
      out.startDate = c.startDate ? new Date(c.startDate) : null;
    if (c.dueDate !== undefined)
      out.dueDate = c.dueDate ? new Date(c.dueDate) : null;
    if (c.focusDate !== undefined)
      out.focusDate = c.focusDate ? new Date(c.focusDate) : null;
    if (c.isRecheck !== undefined) out.isRecheck = c.isRecheck;
    return out;
  }

  private buildActivities(
    existing: IssueRowForUpdate,
    fieldUpdates: Record<string, unknown>,
  ): ActivityRowToWrite[] {
    const activities: ActivityRowToWrite[] = [];
    const existingAsRecord = existing as unknown as Record<string, unknown>;
    for (const key of TRACKED_FIELDS) {
      const next = fieldUpdates[key as TrackedField];
      if (next === undefined) continue;
      const oldStr =
        existingAsRecord[key] != null ? String(existingAsRecord[key]) : null;
      const newStr = next != null ? String(next) : null;
      if (newStr !== oldStr) {
        activities.push({ field: key, oldValue: oldStr, newValue: newStr });
      }
    }
    return activities;
  }

  /**
   * Coalesce a rapid sequence of changes on `field` by the same user
   * into a single activity row. Mutates `activities` in place. Returns
   * `true` when the net change is a no-op (caller should skip
   * notification / cancel pending DM).
   */
  private async coalesceField(
    activities: ActivityRowToWrite[],
    field: 'assigneeId' | 'reviewerAssigneeId',
    issueId: string,
    actorId: string,
  ): Promise<boolean> {
    const idx = activities.findIndex((a) => a.field === field);
    if (idx === -1) return false;

    const current = activities[idx];
    const recent = await this.repo.findRecentActivityForCoalesce(
      issueId,
      actorId,
      field,
      ASSIGNEE_ACTIVITY_COALESCE_MS,
    );
    if (!recent) return false;

    // Always remove the recent row; we'll either replace with a
    // coalesced one (A→B→C ⇒ A→C) or drop entirely (A→B→A ⇒ no-op).
    await this.repo.deleteActivity(recent.id);
    if (recent.oldValue === current.newValue) {
      activities.splice(idx, 1);
      return true;
    }
    activities[idx] = { ...current, oldValue: recent.oldValue };
    return false;
  }

  private async scheduleNotification(
    existing: IssueRowForUpdate,
    cmd: UpdateIssueCommand,
    newTargetUserId: string,
    opts: { kind: 'ASSIGNED' | 'REVIEWER_ASSIGNED'; silent: boolean },
  ): Promise<void> {
    if (opts.silent) {
      this.notifications.cancelPendingAssignment(existing.id, opts.kind);
      return;
    }
    const [projectKey, actorName] = await Promise.all([
      this.repo.fetchProjectKey(cmd.projectId),
      this.repo.fetchUserName(cmd.actorId),
    ]);
    const verb =
      opts.kind === 'REVIEWER_ASSIGNED' ? 'reviewer of' : 'assigned to';
    const key = projectKey ?? '';
    this.notifications.scheduleAssignmentNotification({
      type: opts.kind,
      message: `${key}-${existing.number} "${existing.title}" has been ${verb} you`,
      userId: newTargetUserId,
      issueId: existing.id,
      projectId: cmd.projectId,
      actorId: cmd.actorId,
      meta: {
        projectKey: key,
        issueNumber: existing.number,
        issueTitle: existing.title,
        actorName: actorName ?? undefined,
      },
    });
  }

  private async cascadeAutoAssignChildren(
    parent: IssueRowForUpdate,
    newAssigneeId: string,
    actorId: string,
  ): Promise<void> {
    const children = await this.repo.findUnassignedChildren(parent.id);
    if (children.length === 0) return;

    await this.repo.bulkAssignChildren(
      children.map((c) => c.id),
      newAssigneeId,
      actorId,
    );

    const projectKey =
      (await this.repo.fetchProjectKey(parent.projectId)) ?? '';
    const actorName = (await this.repo.fetchUserName(actorId)) ?? undefined;
    for (const child of children) {
      this.notifications.scheduleAssignmentNotification({
        type: 'ASSIGNED',
        message: `${projectKey}-${child.number} "${child.title}" has been assigned to you`,
        userId: newAssigneeId,
        issueId: child.id,
        projectId: parent.projectId,
        actorId,
        meta: {
          projectKey,
          issueNumber: child.number,
          issueTitle: child.title,
          actorName,
        },
      });
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
