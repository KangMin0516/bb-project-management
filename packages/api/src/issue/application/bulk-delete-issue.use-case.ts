import { Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPOSITORY,
  type IssueRepository,
} from './ports/issue.repository.js';

export interface BulkDeleteIssueCommand {
  projectId: string;
  issueIds: string[];
}

/**
 * Bulk-delete issues. No project-membership second check — that's
 * handled by ProjectMemberGuard at the controller, and the
 * `deleteMany` predicate filters by `projectId` so cross-project
 * ids are silently ignored. Matches legacy behaviour (returns the
 * affected count, doesn't 400 on partial misses).
 */
@Injectable()
export class BulkDeleteIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
  ) {}

  async execute(cmd: BulkDeleteIssueCommand): Promise<{ deleted: number }> {
    const count = await this.repo.bulkDelete(cmd.projectId, cmd.issueIds);
    return { deleted: count };
  }
}
