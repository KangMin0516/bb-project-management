import { Module } from '@nestjs/common';
import { IssueController } from './issue.controller.js';
import { IssueService } from './issue.service.js';
import { ArchiveScheduler } from './archive.scheduler.js';
import { NotificationModule } from '../notification/notification.module.js';
import { IssueLinkModule } from '../issue-link/issue-link.module.js';

@Module({
  imports: [NotificationModule, IssueLinkModule],
  controllers: [IssueController],
  providers: [IssueService, ArchiveScheduler],
  exports: [IssueService],
})
export class IssueModule {}
