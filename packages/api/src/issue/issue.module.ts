import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { IssueLinkModule } from '../issue-link/issue-link.module.js';
import { BulkDeleteIssueUseCase } from './application/bulk-delete-issue.use-case.js';
import { BulkSetParentUseCase } from './application/bulk-set-parent.use-case.js';
import { BulkUpdateIssueUseCase } from './application/bulk-update-issue.use-case.js';
import { CreateIssueUseCase } from './application/create-issue.use-case.js';
import { IssueQueryService } from './application/issue-query.service.js';
import { ISSUE_REPOSITORY } from './application/ports/issue.repository.js';
import { RemoveIssueUseCase } from './application/remove-issue.use-case.js';
import { ReorderIssueUseCase } from './application/reorder-issue.use-case.js';
import { UpdateIssueUseCase } from './application/update-issue.use-case.js';
import { IssuePrismaRepository } from './infrastructure/issue.prisma.repository.js';
import { ArchiveScheduler } from './archive.scheduler.js';
import { IssueController } from './issue.controller.js';

/**
 * Issue module — fully migrated to Clean Architecture per
 * refactor-plan.md §7.6. The legacy IssueService has been deleted;
 * every endpoint routes through a Use Case + Repository + Query
 * Service triad.
 */
@Module({
  imports: [NotificationModule, IssueLinkModule],
  controllers: [IssueController],
  providers: [
    ArchiveScheduler,
    IssueQueryService,
    IssuePrismaRepository,
    { provide: ISSUE_REPOSITORY, useExisting: IssuePrismaRepository },
    CreateIssueUseCase,
    UpdateIssueUseCase,
    ReorderIssueUseCase,
    RemoveIssueUseCase,
    BulkUpdateIssueUseCase,
    BulkDeleteIssueUseCase,
    BulkSetParentUseCase,
  ],
  exports: [
    CreateIssueUseCase,
    UpdateIssueUseCase,
    ReorderIssueUseCase,
    RemoveIssueUseCase,
    BulkSetParentUseCase,
    IssueQueryService,
  ],
})
export class IssueModule {}
