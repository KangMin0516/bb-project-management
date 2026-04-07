import { Module } from '@nestjs/common';
import { IssueController } from './issue.controller.js';
import { IssueService } from './issue.service.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [NotificationModule],
  controllers: [IssueController],
  providers: [IssueService],
  exports: [IssueService],
})
export class IssueModule {}
