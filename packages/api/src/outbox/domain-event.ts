/**
 * Contract between event producers (use cases) and consumers (outbox
 * publisher, in-process listeners).
 *
 * `type` is the routing key — handlers register under it. Use a
 * string literal type per event class (e.g. IssueAssignedEvent.type =
 * 'IssueAssigned'). Avoid stringly-typed bugs by exporting a
 * shared union somewhere central if the count grows beyond ~10.
 */
export interface DomainEvent<TPayload = unknown> {
  /** Routing key; the publisher dispatches on this. */
  readonly type: string;
  /** Aggregate the event belongs to (e.g. 'Issue', 'Project'). */
  readonly aggregateType: string;
  /** Aggregate's primary key — required for state-check idempotency. */
  readonly aggregateId: string;
  /** Serialised event body. Stored as JSONB on the outbox row. */
  readonly payload: TPayload;
  /**
   * Optional minimum delivery time. The publisher will not pick up the
   * row before this instant. Used for grace-period events (e.g.
   * assignment notifications wait 10 s before sending to allow the
   * user to undo). Defaults to "deliver now".
   */
  readonly deliverAfter?: Date;
}
