export class ProjectArchivedEvent {
  static readonly type = 'ProjectArchived' as const;
  readonly type = ProjectArchivedEvent.type;

  constructor(
    readonly projectId: string,
    readonly key: string,
    readonly actorId: string,
    readonly archivedAt: Date,
    readonly occurredAt: Date = new Date(),
  ) {}
}
