import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ISSUE_REPOSITORY,
  type IssueRepository,
} from './ports/issue.repository.js';

export interface BulkSetParentCommand {
  projectId: string;
  actorId: string;
  /** Epic ids to move under a new Module (DOMAIN), or unparent. */
  issueIds: string[];
  /** New DOMAIN parent id, or null to clear the Module assignment. */
  parentId: string | null;
  /** Client that originated the bulk action — stamped on activity rows. */
  source?: import('../../common/source.js').SourceLiteral;
}

/**
 * Bulk-assign Module (DOMAIN) to a list of Epics. Mirrors the
 * BulkUpdateIssueUseCase shape but targets the Domain → Epic
 * relationship specifically:
 *  - Every input must be an EPIC in `projectId`.
 *  - The proposed parent (when not null) must be a DOMAIN in the
 *    same project.
 *  - The repository writes the update + per-issue activity rows in a
 *    single transaction so the activity feed reflects the bulk move.
 */
@Injectable()
export class BulkSetParentUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
  ) {}

  async execute(cmd: BulkSetParentCommand): Promise<{ updated: number }> {
    if (cmd.issueIds.length === 0) {
      throw new BadRequestException('issueIds must not be empty');
    }

    // 1. Verify proposed parent (when set) is a DOMAIN in the same project.
    if (cmd.parentId !== null) {
      const parent = await this.repo.findIssueProjectAndType(cmd.parentId);
      if (!parent) throw new NotFoundException('Parent Module not found');
      if (parent.projectId !== cmd.projectId) {
        throw new BadRequestException(
          'Parent Module belongs to a different project',
        );
      }
      if (parent.type !== 'DOMAIN') {
        throw new BadRequestException('Parent must be a Module (DOMAIN)');
      }
    }

    // 2. Verify every input is an EPIC in the project.
    const rows = await this.repo.findMinimalForParentBulk(
      cmd.projectId,
      cmd.issueIds,
    );
    if (rows.length !== cmd.issueIds.length) {
      throw new BadRequestException(
        `${cmd.issueIds.length - rows.length} issue(s) not found in this project`,
      );
    }
    const nonEpics = rows.filter((r) => r.type !== 'EPIC');
    if (nonEpics.length > 0) {
      throw new BadRequestException(
        'Only Epics can be re-parented in bulk; non-Epic ids: ' +
          nonEpics.map((r) => r.id).join(', '),
      );
    }

    // 3. Atomic write + activity log. Rows whose parentId already
    //    matches the target are filtered out at the repository so the
    //    activity feed isn't spammed with no-op entries.
    await this.repo.bulkSetParent(rows, cmd.parentId, cmd.actorId, cmd.source);

    return { updated: rows.length };
  }
}
