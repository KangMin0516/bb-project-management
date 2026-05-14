import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from './domain-event.js';
import { OutboxRepository } from './outbox.repository.js';

// Cross-cutting type for "either the base PrismaClient or a tx slice".
// Re-declared inline to avoid an extra import from the repository file.
type TxLike = Parameters<OutboxRepository['append']>[1];

/**
 * The single entry point for producers ("use case made something happen
 * — please make sure consumers see it"). Behaviour:
 *
 *   1. Append the row to `outbox_events` (inside the caller's tx if
 *      supplied). This is the at-least-once durability guarantee — if
 *      the row commits, the side-effect will eventually run.
 *
 *   2. Emit the event on the in-process bus. Fast-path listeners (UI
 *      cache invalidation, activity log) react immediately. **In-process
 *      delivery is best-effort** — it doesn't promise survival across
 *      restarts; that's the outbox row's job.
 *
 * Callers should not import EventEmitter2 directly — go through this
 * bus so both delivery paths stay coherent.
 */
@Injectable()
export class OutboxEventBus {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Publish an event. When invoked inside a `prisma.$transaction`, pass
   * the tx so the outbox row commits or rolls back atomically with the
   * business write.
   */
  async publish(event: DomainEvent, tx?: TxLike): Promise<void> {
    await this.outbox.append(event, tx);
    // In-process emit happens AFTER outbox append — if the append
    // fails, no in-memory listener fires either, keeping the two
    // paths agreement on whether the event happened.
    this.emitter.emit(event.type, event);
  }
}
