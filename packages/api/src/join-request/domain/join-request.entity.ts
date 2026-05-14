import type { JoinRequestStatus } from './join-request-status.vo.js';
import { JoinRequestApprovedEvent } from './events/join-request-approved.event.js';
import { JoinRequestCreatedEvent } from './events/join-request-created.event.js';
import { JoinRequestRejectedEvent } from './events/join-request-rejected.event.js';

export type JoinRequestDomainErrorCode =
  | 'ALREADY_RESOLVED'
  | 'NOT_REQUESTER'
  | 'EMPTY_REASON';

export class JoinRequestDomainError extends Error {
  constructor(
    readonly code: JoinRequestDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'JoinRequestDomainError';
  }
}

export interface JoinRequestProps {
  id: string;
  projectId: string;
  requesterId: string;
  message: string | null;
  status: JoinRequestStatus;
  rejectionReason: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface NewJoinRequestInput {
  id: string;
  projectId: string;
  requesterId: string;
  message?: string | null;
}

/**
 * Project join request — state machine (PENDING → APPROVED|REJECTED).
 * Once resolved, the row is immutable (a fresh request creates a new
 * row with a new id; the legacy "re-request" flow handles that by
 * deleting the old row at the repository layer, not on the entity).
 *
 * Cancellation is "delete from PENDING" — represented as a domain
 * predicate (`canCancel`) so the use case can guard the repository
 * delete call without the entity needing a "cancelled" state.
 */
export class JoinRequest {
  private readonly _events: object[] = [];

  private constructor(private props: JoinRequestProps) {}

  // ─── Factory ──────────────────────────────────────────────

  static create(
    input: NewJoinRequestInput,
    now: Date = new Date(),
  ): JoinRequest {
    const message = (input.message ?? '').trim() || null;
    const request = new JoinRequest({
      id: input.id,
      projectId: input.projectId,
      requesterId: input.requesterId,
      message,
      status: 'PENDING',
      rejectionReason: null,
      resolvedById: null,
      resolvedAt: null,
      createdAt: now,
    });
    request._events.push(
      new JoinRequestCreatedEvent(
        request.id,
        request.projectId,
        request.requesterId,
        message,
        now,
      ),
    );
    return request;
  }

  /** Reconstitute from persistence — no events emitted. */
  static fromPersistence(props: JoinRequestProps): JoinRequest {
    return new JoinRequest(props);
  }

  // ─── Read accessors ───────────────────────────────────────

  get id() {
    return this.props.id;
  }
  get projectId() {
    return this.props.projectId;
  }
  get requesterId() {
    return this.props.requesterId;
  }
  get status() {
    return this.props.status;
  }
  get message() {
    return this.props.message;
  }
  get rejectionReason() {
    return this.props.rejectionReason;
  }
  get resolvedById() {
    return this.props.resolvedById;
  }
  get resolvedAt() {
    return this.props.resolvedAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  get isPending() {
    return this.props.status === 'PENDING';
  }

  /** Snapshot for the persistence mapper. */
  toJSON(): Readonly<JoinRequestProps> {
    return { ...this.props };
  }

  pullEvents(): object[] {
    const out = this._events.slice();
    this._events.length = 0;
    return out;
  }

  // ─── Behaviours ───────────────────────────────────────────

  approve(resolvedById: string, now: Date = new Date()): void {
    if (this.props.status !== 'PENDING') {
      throw new JoinRequestDomainError(
        'ALREADY_RESOLVED',
        'This join request has already been resolved',
      );
    }
    this.props.status = 'APPROVED';
    this.props.resolvedById = resolvedById;
    this.props.resolvedAt = now;
    this._events.push(
      new JoinRequestApprovedEvent(
        this.props.id,
        this.props.projectId,
        this.props.requesterId,
        resolvedById,
        now,
      ),
    );
  }

  reject(
    resolvedById: string,
    reason: string | null,
    now: Date = new Date(),
  ): void {
    if (this.props.status !== 'PENDING') {
      throw new JoinRequestDomainError(
        'ALREADY_RESOLVED',
        'This join request has already been resolved',
      );
    }
    const trimmed = (reason ?? '').trim() || null;
    this.props.status = 'REJECTED';
    this.props.resolvedById = resolvedById;
    this.props.resolvedAt = now;
    this.props.rejectionReason = trimmed;
    this._events.push(
      new JoinRequestRejectedEvent(
        this.props.id,
        this.props.projectId,
        this.props.requesterId,
        resolvedById,
        trimmed,
        now,
      ),
    );
  }

  /**
   * Permission + state guard for cancellation. The actual row delete
   * happens at the repository layer — this method throws if the
   * caller isn't allowed to.
   */
  ensureCancellableBy(userId: string): void {
    if (this.props.requesterId !== userId) {
      throw new JoinRequestDomainError(
        'NOT_REQUESTER',
        'Only the requester can cancel this join request',
      );
    }
    if (!this.isPending) {
      throw new JoinRequestDomainError(
        'ALREADY_RESOLVED',
        'Only pending requests can be canceled',
      );
    }
  }
}
