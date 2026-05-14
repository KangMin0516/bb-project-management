import { Module, type OnModuleInit } from '@nestjs/common';
import { SlackModule } from '../slack/slack.module.js';
import { OutboxHandlerRegistry } from '../outbox/outbox-handler.registry.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import type { ClaimedOutboxRow } from '../outbox/outbox.repository.js';

@Module({
  imports: [SlackModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule implements OnModuleInit {
  constructor(
    private readonly registry: OutboxHandlerRegistry,
    private readonly service: NotificationService,
  ) {}

  /**
   * Register outbox handlers on module init. Keeping the registration
   * here (vs in the service) means the service stays unaware of the
   * routing key — wiring lives at the composition root.
   */
  onModuleInit(): void {
    this.registry.register('IssueAssignedDelivery', (row: ClaimedOutboxRow) =>
      this.service.handleIssueAssignedDelivery(
        row.payload as Parameters<
          NotificationService['handleIssueAssignedDelivery']
        >[0],
      ),
    );
  }
}
