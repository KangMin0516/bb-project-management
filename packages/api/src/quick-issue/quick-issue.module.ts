import { Module } from '@nestjs/common';
import { AI_COMPLETION_PORT } from '../common/ports/ai-completion.port.js';
import { IssueModule } from '../issue/issue.module.js';
import { AnthropicAdapter } from './infrastructure/anthropic.adapter.js';
import { QuickIssueController } from './quick-issue.controller.js';
import { QuickIssueService } from './quick-issue.service.js';

@Module({
  imports: [IssueModule],
  controllers: [QuickIssueController],
  providers: [
    QuickIssueService,
    AnthropicAdapter,
    { provide: AI_COMPLETION_PORT, useExisting: AnthropicAdapter },
  ],
  exports: [QuickIssueService],
})
export class QuickIssueModule {}
