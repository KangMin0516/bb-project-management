import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISSUE_REPOSITORY,
  type IssueRepository,
} from './ports/issue.repository.js';

export interface RemoveIssueCommand {
  projectId: string;
  issueId: string;
}

/**
 * Hard-delete an issue. Project scoping checked via repository
 * findForUpdate (cheaper than a full include). Cascade behaviour is
 * declared in the Prisma schema — activities, comments, label /
 * component join rows, attachments all go with the row.
 */
@Injectable()
export class RemoveIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
  ) {}

  async execute(cmd: RemoveIssueCommand): Promise<{ deleted: true }> {
    const existing = await this.repo.findForUpdate(cmd.issueId);
    if (!existing || existing.projectId !== cmd.projectId) {
      throw new NotFoundException('Issue not found');
    }
    await this.repo.delete(cmd.issueId);
    return { deleted: true };
  }
}
