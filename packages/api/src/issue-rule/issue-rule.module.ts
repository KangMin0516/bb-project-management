import { Module } from '@nestjs/common';
import { IssueRuleController } from './issue-rule.controller.js';
import { IssueRuleService } from './issue-rule.service.js';

@Module({
  controllers: [IssueRuleController],
  providers: [IssueRuleService],
  exports: [IssueRuleService],
})
export class IssueRuleModule {}
