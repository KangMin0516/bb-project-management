import type { IssueType } from '../issue-type.vo.js';

export class IssueCreatedEvent {
  static readonly type = 'IssueCreated' as const;
  readonly type = IssueCreatedEvent.type;

  constructor(
    readonly issueId: string,
    readonly projectId: string,
    readonly issueType: IssueType,
    readonly creatorId: string,
    readonly assigneeId: string | null,
    readonly occurredAt: Date = new Date(),
  ) {}
}
