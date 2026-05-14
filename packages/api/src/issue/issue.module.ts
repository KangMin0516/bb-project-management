import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { IssueLinkModule } from '../issue-link/issue-link.module.js';
import { CreateIssueUseCase } from './application/create-issue.use-case.js';
import { IssueQueryService } from './application/issue-query.service.js';
import { ISSUE_REPOSITORY } from './application/ports/issue.repository.js';
import { UpdateIssueUseCase } from './application/update-issue.use-case.js';
import { IssuePrismaRepository } from './infrastructure/issue.prisma.repository.js';
import { ArchiveScheduler } from './archive.scheduler.js';
import { IssueController } from './issue.controller.js';
import { IssueService } from './issue.service.js';

/**
 * Issue module — mid-migration. Phase 1 (M3) has carved out Create
 * + read paths into a use case / query service + repository port.
 * Update / reorder / bulk / delete still live in the legacy
 * IssueService; they'll move in follow-up phases. The legacy service
 * stays exported so `external` and `quick-issue` modules can still
 * inject it for the flows they consume that aren't migrated yet.
 */
@Module({
  imports: [NotificationModule, IssueLinkModule],
  controllers: [IssueController],
  providers: [
    IssueService,
    ArchiveScheduler,
    IssueQueryService,
    IssuePrismaRepository,
    { provide: ISSUE_REPOSITORY, useExisting: IssuePrismaRepository },
    CreateIssueUseCase,
    UpdateIssueUseCase,
  ],
  exports: [IssueService, CreateIssueUseCase, UpdateIssueUseCase],
})
export class IssueModule {}
