import { Module } from '@nestjs/common';
import { SlackModule } from '../slack/slack.module.js';
import { QuickIssueModule } from '../quick-issue/quick-issue.module.js';
import { StandupController } from './standup.controller.js';
import { StandupWebhookController } from './standup-webhook.controller.js';
import { StandupService } from './standup.service.js';
import { StandupScheduler } from './standup.scheduler.js';

@Module({
  imports: [SlackModule, QuickIssueModule],
  controllers: [StandupController, StandupWebhookController],
  providers: [StandupService, StandupScheduler],
})
export class StandupModule {}
