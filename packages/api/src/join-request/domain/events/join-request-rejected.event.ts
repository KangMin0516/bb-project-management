export class JoinRequestRejectedEvent {
  static readonly type = 'JoinRequestRejected' as const;
  readonly type = JoinRequestRejectedEvent.type;

  constructor(
    readonly requestId: string,
    readonly projectId: string,
    readonly requesterId: string,
    readonly resolvedById: string,
    readonly reason: string | null,
    readonly occurredAt: Date = new Date(),
  ) {}
}
