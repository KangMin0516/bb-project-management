export class ProjectCreatedEvent {
  static readonly type = 'ProjectCreated' as const;
  readonly type = ProjectCreatedEvent.type;

  constructor(
    readonly projectId: string,
    readonly key: string,
    readonly creatorId: string,
    readonly occurredAt: Date = new Date(),
  ) {}
}
