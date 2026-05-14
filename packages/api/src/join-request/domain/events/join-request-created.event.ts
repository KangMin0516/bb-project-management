export class JoinRequestCreatedEvent {
  static readonly type = 'JoinRequestCreated' as const;
  readonly type = JoinRequestCreatedEvent.type;

  constructor(
    readonly requestId: string,
    readonly projectId: string,
    readonly requesterId: string,
    readonly message: string | null,
    readonly occurredAt: Date = new Date(),
  ) {}
}
