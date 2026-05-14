/**
 * Repository port for the Issue write side. The read side is served
 * by IssueQueryService (CQRS-lite); this port handles aggregate
 * persistence and the small set of cross-aggregate lookups the
 * write-time use cases need.
 *
 * Phase 1 added Create. Phase 2 adds Update — the helpers below
 * (hierarchy cycle detection, activity coalesce, child fan-out) are
 * all support ops for that flow.
 */
export const ISSUE_REPOSITORY = Symbol('ISSUE_REPOSITORY');

export type IssueTypeLiteral = 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK';
export type IssueStatusLiteral =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW_QA'
  | 'DONE'
  | 'CANCELED';
export type IssuePriorityLiteral = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CreateIssuePayload {
  id?: string;
  projectId: string;
  creatorId: string;
  title: string;
  description: string | null;
  type: IssueTypeLiteral;
  status: IssueStatusLiteral;
  priority: IssuePriorityLiteral;
  parentId: string | null;
  assigneeId: string | null;
  reviewerAssigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  labelIds: string[];
  componentIds: string[];
}

/** Row shape returned by `findForUpdate` — every field the update
 *  use case needs to diff + branch on archive/recheck/hierarchy. */
export interface IssueRowForUpdate {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string | null;
  type: IssueTypeLiteral;
  status: IssueStatusLiteral;
  priority: IssuePriorityLiteral;
  parentId: string | null;
  assigneeId: string | null;
  reviewerAssigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  focusDate: Date | null;
  isRecheck: boolean;
  archivedAt: Date | null;
}

export interface ActivityRowToWrite {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface RecentActivityRow {
  id: string;
  oldValue: string | null;
}

export interface UpdateIssuePayload {
  issueId: string;
  /** Direct field writes — keys map to Prisma `data` shape. */
  fieldUpdates: Record<string, unknown>;
  /** Replace-all when defined; ignored when undefined. */
  labelIds?: string[];
  /** Replace-all when defined; ignored when undefined. */
  componentIds?: string[];
  /** Activity rows to nest-create alongside the issue update. */
  activities: ActivityRowToWrite[];
  /** Actor id used as `userId` on the activity rows. */
  actorId: string;
}

export interface ChildIssue {
  id: string;
  number: number;
  title: string;
}

export interface IssueRepository {
  // ─── Create (Phase 1) ──────────────────────────────────────
  createWithSequenceAndActivity(payload: CreateIssuePayload): Promise<unknown>;
  fetchParentType(parentId: string): Promise<IssueTypeLiteral | null>;
  resolveComponentDefaultAssignee(
    projectId: string,
    componentIds: string[],
  ): Promise<string | null>;

  // ─── Update (Phase 2) ─────────────────────────────────────

  /** Full row needed to diff + branch on archive/recheck/hierarchy. */
  findForUpdate(issueId: string): Promise<IssueRowForUpdate | null>;

  /**
   * Walk the parent chain starting at `fromParentId` until either a
   * root (parentId = null) or the supplied `targetId` is encountered.
   * Returns true when the chain reaches `targetId` (= cycle). Bounded
   * by the same single-query-per-step pattern the legacy service used.
   */
  parentChainContains(fromParentId: string, targetId: string): Promise<boolean>;

  /**
   * Most-recent activity row for (issueId, userId, field) within the
   * coalesce window (`sinceMs` past). Used by the rapid-click coalesce.
   */
  findRecentActivityForCoalesce(
    issueId: string,
    userId: string,
    field: 'assigneeId' | 'reviewerAssigneeId',
    sinceMs: number,
  ): Promise<RecentActivityRow | null>;

  deleteActivity(activityId: string): Promise<void>;

  /**
   * Apply the update + nested label / component / activity writes
   * in a single Prisma call (Prisma flattens to one transaction
   * internally). Returns the row with the standard issue include.
   */
  updateWithLinksAndActivities(payload: UpdateIssuePayload): Promise<unknown>;

  fetchProjectKey(projectId: string): Promise<string | null>;

  fetchUserName(userId: string): Promise<string | null>;

  findUnassignedChildren(parentId: string): Promise<ChildIssue[]>;

  /**
   * Atomic bulk-assign children + create per-child activity rows.
   * Wraps `updateMany` + `activity.createMany` in `$transaction` —
   * mirrors the legacy implementation.
   */
  bulkAssignChildren(
    childIds: string[],
    assigneeId: string,
    actorId: string,
  ): Promise<void>;
}
