import { Module } from '@nestjs/common';
import { IssueModule } from '../issue/issue.module.js';
import { QuickIssueController } from './quick-issue.controller.js';
import { QuickIssueService } from './quick-issue.service.js';

@Module({
  imports: [IssueModule],
  controllers: [QuickIssueController],
  providers: [QuickIssueService],
  exports: [QuickIssueService],
})
export class QuickIssueModule {}
