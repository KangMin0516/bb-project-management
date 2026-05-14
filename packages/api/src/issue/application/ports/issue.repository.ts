/**
 * Repository port for the Issue write side. The read side is served
 * by IssueQueryService (CQRS-lite); this port handles aggregate
 * persistence and the small set of cross-aggregate lookups the
 * write-time use cases need.
 *
 * Phase 1 surface only — Create flow. Update / reorder / bulk
 * methods will be added when their use cases land.
 */
export const ISSUE_REPOSITORY = Symbol('ISSUE_REPOSITORY');

export interface CreateIssuePayload {
  id?: string;
  projectId: string;
  creatorId: string;
  title: string;
  description: string | null;
  type: 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK';
  status:
    | 'BACKLOG'
    | 'TODO'
    | 'IN_PROGRESS'
    | 'REVIEW_QA'
    | 'DONE'
    | 'CANCELED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  parentId: string | null;
  assigneeId: string | null;
  reviewerAssigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  labelIds: string[];
  componentIds: string[];
}

export interface IssueRepository {
  /**
   * Atomic create. Computes the next per-project number + per-column
   * order inside the same `$transaction` as the row insert + the
   * initial 'created' activity row + label / component links.
   * Returns the row with the standard ISSUE_INCLUDE shape so the
   * controller can echo it verbatim.
   */
  createWithSequenceAndActivity(payload: CreateIssuePayload): Promise<unknown>;

  /**
   * Fetch a parent's `type` so the use case can run domain hierarchy
   * validation (`validateTypeWithParent`). Returns null when the
   * parent id does not exist.
   */
  fetchParentType(
    parentId: string,
  ): Promise<'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK' | null>;

  /**
   * Resolve the first non-null `defaultAssigneeId` among the supplied
   * project components — used by the Create flow to auto-fill
   * assignee when none is provided (I-C4). Returns null when no
   * matching component has a default.
   */
  resolveComponentDefaultAssignee(
    projectId: string,
    componentIds: string[],
  ): Promise<string | null>;
}
