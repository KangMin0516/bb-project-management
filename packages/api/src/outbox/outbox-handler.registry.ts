import { Injectable, Logger } from '@nestjs/common';
import type { ClaimedOutboxRow } from './outbox.repository.js';

/**
 * Handler for a single event type. Receives the raw outbox row so the
 * handler can:
 *   - read its own payload (typed via cast — handler owns the contract)
 *   - decide to skip (return without error) when state-check
 *     idempotency rules out delivery (e.g. issue no longer assigned
 *     to the user named in the payload)
 *   - throw to signal a retryable failure
 */
export type OutboxHandler = (row: ClaimedOutboxRow) => Promise<void>;

/**
 * Module-global registry. Producers + adapters register handlers
 * during module init; the publisher looks them up by `eventType`
 * when dispatching.
 *
 * Why module-global and not per-event injection: NestJS DI doesn't
 * have a great story for "discover all providers tagged with X" —
 * a small registry is more honest than the convoluted ModuleRef
 * dance, and keeps the publisher decoupled from the set of
 * available handlers.
 */
@Injectable()
export class OutboxHandlerRegistry {
  private readonly logger = new Logger(OutboxHandlerRegistry.name);
  private readonly handlers = new Map<string, OutboxHandler>();

  register(eventType: string, handler: OutboxHandler): void {
    if (this.handlers.has(eventType)) {
      this.logger.warn(
        `Outbox handler for "${eventType}" re-registered — overwriting`,
      );
    }
    this.handlers.set(eventType, handler);
  }

  get(eventType: string): OutboxHandler | undefined {
    return this.handlers.get(eventType);
  }

  /** Returns the set of registered event types (debug / health). */
  knownEventTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
