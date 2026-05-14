import type { IssuePriority } from './issue-priority.vo.js';
import type { IssueStatus } from './issue-status.vo.js';
import {
  type IssueType,
  validateTypeWithParent,
  type HierarchyError,
} from './issue-type.vo.js';
import { IssueAssignedEvent } from './events/issue-assigned.event.js';
import { IssueCreatedEvent } from './events/issue-created.event.js';

/**
 * Domain error — pure value, framework-free. Application layer maps this
 * onto a NestJS exception (BadRequest/Forbidden/etc.) at its boundary.
 */
export class IssueDomainError extends Error {
  constructor(
    readonly code: HierarchyError | 'INVARIANT_VIOLATION',
    message: string,
  ) {
    super(message);
    this.name = 'IssueDomainError';
  }
}

export interface IssueProps {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  parentId: string | null;
  assigneeId: string | null;
  reviewerAssigneeId: string | null;
  creatorId: string;
  order: number;
  startDate: Date | null;
  dueDate: Date | null;
  focusDate: Date | null;
  isRecheck: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewIssueInput {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description?: string | null;
  type: IssueType;
  priority?: IssuePriority;
  parentId?: string | null;
  /** Parent's `type` — caller resolves before calling factory. */
  parentType?: IssueType | null;
  assigneeId?: string | null;
  reviewerAssigneeId?: string | null;
  creatorId: string;
  order: number;
}

/**
 * Issue aggregate-ish root. Carries invariants for type/parent compatibility
 * (I-C1, I-C2, I-C3) and assignment transitions (I-U5). Read-only from the
 * outside; mutate via methods. Side-effects are captured as domain events
 * that the application layer collects and publishes.
 */
export class Issue {
  private readonly _events: object[] = [];

  private constructor(private props: IssueProps) {}

  // ─── Factory ──────────────────────────────────────────────────────

  static create(input: NewIssueInput, now: Date = new Date()): Issue {
    const parentType = input.parentType ?? null;
    const parentId = input.parentId ?? null;

    const err = validateTypeWithParent(input.type, parentId, parentType);
    if (err) throw new IssueDomainError(err, hierarchyMessage(err));

    const issue = new Issue({
      id: input.id,
      projectId: input.projectId,
      number: input.number,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      status: 'BACKLOG',
      priority: input.priority ?? 'MEDIUM',
      parentId,
      assigneeId: input.assigneeId ?? null,
      reviewerAssigneeId: input.reviewerAssigneeId ?? null,
      creatorId: input.creatorId,
      order: input.order,
      startDate: null,
      dueDate: null,
      focusDate: null,
      isRecheck: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    issue._events.push(
      new IssueCreatedEvent(
        issue.id,
        issue.projectId,
        issue.type,
        issue.creatorId,
        issue.assigneeId,
        now,
      ),
    );

    return issue;
  }

  /** Reconstructs an Issue from persistence — no events emitted. */
  static fromPersistence(props: IssueProps): Issue {
    return new Issue(props);
  }

  // ─── Read accessors ───────────────────────────────────────────────

  get id() {
    return this.props.id;
  }
  get projectId() {
    return this.props.projectId;
  }
  get number() {
    return this.props.number;
  }
  get type() {
    return this.props.type;
  }
  get status() {
    return this.props.status;
  }
  get priority() {
    return this.props.priority;
  }
  get parentId() {
    return this.props.parentId;
  }
  get assigneeId() {
    return this.props.assigneeId;
  }
  get reviewerAssigneeId() {
    return this.props.reviewerAssigneeId;
  }
  get creatorId() {
    return this.props.creatorId;
  }
  get title() {
    return this.props.title;
  }
  get description() {
    return this.props.description;
  }
  get order() {
    return this.props.order;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }
  get isArchived() {
    return this.props.archivedAt !== null;
  }

  /** Read-only snapshot for mapper-to-row. */
  toJSON(): Readonly<IssueProps> {
    return { ...this.props };
  }

  /** Drain accumulated events; called by application layer after persist. */
  pullEvents(): object[] {
    const out = this._events.slice();
    this._events.length = 0;
    return out;
  }

  // ─── Behaviours ───────────────────────────────────────────────────

  /**
   * Sets a new parent. Caller must resolve the parent's `type` first —
   * cycle detection (I-U2) needs DB lookup and is the application
   * layer's job (domain service `IssueHierarchyService` at M3).
   */
  changeParent(
    parentId: string | null,
    parentType: IssueType | null,
    now: Date = new Date(),
  ): void {
    const err = validateTypeWithParent(
      this.props.type,
      parentId,
      parentType,
      this.props.id,
    );
    if (err) throw new IssueDomainError(err, hierarchyMessage(err));
    if (this.props.parentId === parentId) return;
    this.props.parentId = parentId;
    this.props.updatedAt = now;
  }

  /**
   * Assigns the issue. Emits IssueAssignedEvent when the value actually
   * transitions (no event on no-op, no event on unassign-to-null).
   * The 10s coalesce + Slack DM cancel logic (I-U6/I-U7) is enforced
   * downstream at the outbox publisher — domain only records the
   * transition.
   */
  assign(
    newAssigneeId: string | null,
    actorId: string,
    now: Date = new Date(),
  ): void {
    if (this.isArchived) {
      throw new IssueDomainError(
        'INVARIANT_VIOLATION',
        'Cannot assign an archived issue',
      );
    }
    const prev = this.props.assigneeId;
    if (prev === newAssigneeId) return;
    this.props.assigneeId = newAssigneeId;
    this.props.updatedAt = now;
    if (newAssigneeId !== null) {
      this._events.push(
        new IssueAssignedEvent(
          this.props.id,
          this.props.projectId,
          prev,
          newAssigneeId,
          actorId,
          now,
        ),
      );
    }
  }

  archive(now: Date = new Date()): void {
    if (this.isArchived) return;
    this.props.archivedAt = now;
    this.props.updatedAt = now;
  }

  unarchive(now: Date = new Date()): void {
    if (!this.isArchived) return;
    this.props.archivedAt = null;
    this.props.updatedAt = now;
  }
}

function hierarchyMessage(code: HierarchyError): string {
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
