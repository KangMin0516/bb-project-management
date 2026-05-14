export class JoinRequestApprovedEvent {
  static readonly type = 'JoinRequestApproved' as const;
  readonly type = JoinRequestApprovedEvent.type;

  constructor(
    readonly requestId: string,
    readonly projectId: string,
    readonly requesterId: string,
    readonly resolvedById: string,
    readonly occurredAt: Date = new Date(),
  ) {}
}
