import { Global, Module } from '@nestjs/common';
import { OutboxAdminController } from './outbox-admin.controller.js';
import { OutboxEventBus } from './outbox-event-bus.js';
import { OutboxHandlerRegistry } from './outbox-handler.registry.js';
import { OutboxHealthService } from './outbox-health.service.js';
import { OutboxRetentionScheduler } from './outbox-retention.scheduler.js';
import { OutboxPublisher } from './outbox.publisher.js';
import { OutboxRepository } from './outbox.repository.js';

/**
 * Outbox infrastructure — global so any module's use case can inject
 * `OutboxEventBus` without explicit cross-module wiring. Handlers
 * register themselves at module init from their feature modules.
 *
 * Ships with operational tooling: a retention cron (daily prune of
 * delivered rows >30d) and a superuser-only health endpoint
 * (`/admin/outbox/health`) so an operator can monitor backlog +
 * parked dead-letters during rollout.
 */
@Global()
@Module({
  controllers: [OutboxAdminController],
  providers: [
    OutboxRepository,
    OutboxHandlerRegistry,
    OutboxEventBus,
    OutboxPublisher,
    OutboxRetentionScheduler,
    OutboxHealthService,
  ],
  exports: [OutboxEventBus, OutboxHandlerRegistry, OutboxRepository],
})
export class OutboxModule {}
