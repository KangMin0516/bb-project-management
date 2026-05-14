/**
 * Emitted when an issue's `assigneeId` transitions to a non-null value
 * or to a different user. Consumed by:
 *   - in-process: activity log handler
 *   - outbox (post-M2): Slack DM delivery with 10s coalesce window
 *
 * Payload includes the previous assignee so the deliverer can compute
 * net no-op (A→B→A) and skip the Slack DM — see behavior checklist
 * I-U6/I-U7.
 */
export class IssueAssignedEvent {
  static readonly type = 'IssueAssigned' as const;
  readonly type = IssueAssignedEvent.type;

  constructor(
    readonly issueId: string,
    readonly projectId: string,
    readonly previousAssigneeId: string | null,
    readonly newAssigneeId: string,
    readonly actorId: string,
    readonly occurredAt: Date = new Date(),
  ) {}
}
