import { Global, Module } from '@nestjs/common';
import { OutboxEventBus } from './outbox-event-bus.js';
import { OutboxHandlerRegistry } from './outbox-handler.registry.js';
import { OutboxPublisher } from './outbox.publisher.js';
import { OutboxRepository } from './outbox.repository.js';

/**
 * Outbox infrastructure — global so any module's use case can inject
 * `OutboxEventBus` without explicit cross-module wiring. Handlers
 * register themselves at module init from their feature modules.
 */
@Global()
@Module({
  providers: [
    OutboxRepository,
    OutboxHandlerRegistry,
    OutboxEventBus,
    OutboxPublisher,
  ],
  exports: [OutboxEventBus, OutboxHandlerRegistry],
})
export class OutboxModule {}
