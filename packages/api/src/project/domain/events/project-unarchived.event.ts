export class ProjectUnarchivedEvent {
  static readonly type = 'ProjectUnarchived' as const;
  readonly type = ProjectUnarchivedEvent.type;

  constructor(
    readonly projectId: string,
    readonly key: string,
    readonly actorId: string,
    readonly occurredAt: Date = new Date(),
  ) {}
}
