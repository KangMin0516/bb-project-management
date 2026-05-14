import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../../notification/notification.service.js';
import {
  ISSUE_REPOSITORY,
  type BulkIssueRow,
  type IssuePriorityLiteral,
  type IssueRepository,
  type IssueStatusLiteral,
} from './ports/issue.repository.js';

export interface BulkUpdateIssueCommand {
  projectId: string;
  actorId: string;
  issueIds: string[];
  changes: {
    status?: IssueStatusLiteral;
    priority?: IssuePriorityLiteral;
    assigneeId?: string | null;
  };
}

/**
 * Bulk patch a list of issues. Behaviour preserved from legacy
 * IssueService.bulkUpdate (checklist §2.4 I-B1..I-B4):
 *  - All affected issues scoped to project (404 / 400 on mismatch).
 *  - Each touched issue's activity diff written inside one
 *    `$transaction` (I-B1, I-B4 silent flag intentionally not
 *    supported by the legacy bulk DTO).
 *  - Per-issue assignee-change schedules its own Slack DM (I-B2),
 *    no batching — matches legacy.
 */
@Injectable()
export class BulkUpdateIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
    private readonly notifications: NotificationService,
  ) {}

  async execute(cmd: BulkUpdateIssueCommand): Promise<{ updated: number }> {
    const rows = await this.repo.findMinimalForBulk(
      cmd.projectId,
      cmd.issueIds,
    );
    if (rows.length === 0) {
      throw new NotFoundException('No matching issues found');
    }
    if (rows.length !== cmd.issueIds.length) {
      throw new BadRequestException(
        `${cmd.issueIds.length - rows.length} issue(s) not found in this project`,
      );
    }

    const projectKey = (await this.repo.fetchProjectKey(cmd.projectId)) ?? '';
    const actorName = (await this.repo.fetchUserName(cmd.actorId)) ?? undefined;

    await this.repo.bulkUpdateInTransaction(
      rows,
      cmd.changes,
      cmd.actorId,
      (row: BulkIssueRow) => {
        // Only schedule when assignee actually changed for this row.
        if (
          cmd.changes.assigneeId &&
          cmd.changes.assigneeId !== row.assigneeId
        ) {
          this.notifications.scheduleAssignmentNotification({
            type: 'ASSIGNED',
            message: `${projectKey}-${row.number} "${row.title}" has been assigned to you`,
            userId: cmd.changes.assigneeId,
            issueId: row.id,
            projectId: cmd.projectId,
            actorId: cmd.actorId,
            meta: {
              projectKey,
              issueNumber: row.number,
              issueTitle: row.title,
              actorName,
            },
          });
        }
      },
    );

    return { updated: rows.length };
  }
}
