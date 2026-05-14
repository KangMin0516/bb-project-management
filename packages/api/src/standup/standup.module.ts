import { Module, type OnModuleInit } from '@nestjs/common';
import { SlackModule } from '../slack/slack.module.js';
import { QuickIssueModule } from '../quick-issue/quick-issue.module.js';
import { OutboxHandlerRegistry } from '../outbox/outbox-handler.registry.js';
import type { ClaimedOutboxRow } from '../outbox/outbox.repository.js';
import { StandupController } from './standup.controller.js';
import { StandupWebhookController } from './standup-webhook.controller.js';
import { StandupConfigService } from './standup-config.service.js';
import { StandupService } from './standup.service.js';
import {
  StandupScheduler,
  STANDUP_TRIGGER_EVENT,
} from './standup.scheduler.js';

@Module({
  imports: [SlackModule, QuickIssueModule],
  controllers: [StandupController, StandupWebhookController],
  providers: [StandupConfigService, StandupService, StandupScheduler],
})
export class StandupModule implements OnModuleInit {
  constructor(
    private readonly registry: OutboxHandlerRegistry,
    private readonly scheduler: StandupScheduler,
  ) {}

  onModuleInit(): void {
    this.registry.register(STANDUP_TRIGGER_EVENT, (row: ClaimedOutboxRow) =>
      this.scheduler.handleStandupTrigger(
        row.payload as Parameters<StandupScheduler['handleStandupTrigger']>[0],
      ),
    );
  }
}
