import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutboxHandlerRegistry } from './outbox-handler.registry.js';
import {
  OutboxRepository,
  type ClaimedOutboxRow,
} from './outbox.repository.js';

const BATCH_SIZE = 50;
/** Hard ceiling on retries — past this, the row stays in the table but
 *  next_retry_at is pushed far out so the publisher stops touching it.
 *  Operator inspects and either deletes or replays manually. */
const MAX_ATTEMPTS = 8;

/**
 * Polls `outbox_events` every 5 s and dispatches each row to its
 * registered handler. One DB transaction per batch — claim is
 * `FOR UPDATE SKIP LOCKED` so multiple replicas don't fight.
 *
 * Mutex flag prevents overlapping ticks (a slow batch shouldn't get
 * another scheduled tick stacked on top of it).
 */
@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: OutboxRepository,
    private readonly registry: OutboxHandlerRegistry,
  ) {}

  /** Public for tests. Production is driven by @Cron. */
  @Cron('*/5 * * * * *')
  async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pumpOnce();
    } catch (err) {
      this.logger.error(
        'Outbox pump tick crashed',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }

  private async pumpOnce(): Promise<void> {
    // Claim a batch in a short, dedicated transaction. Holding it open
    // across handler invocations is what blew the default 5 s timeout
    // when a tick scooped up many rows whose handlers each fired a
    // Slack HTTP call — the tx died, markDelivered rolled back, and
    // the next tick re-dispatched the same rows (4× Slack spam).
    const batch = await this.prisma.$transaction((tx) =>
      this.repo.claimBatch(tx, BATCH_SIZE),
    );
    for (const row of batch) {
      // Each row's dispatch + mark-* gets its own short transaction.
      // One slow handler no longer threatens the whole batch.
      try {
        await this.prisma.$transaction((tx) => this.dispatchOne(row, tx));
      } catch (err) {
        // dispatchOne already markFailed/markDelivered within its own
        // tx; an error escaping here means the inner transaction
        // itself failed (e.g. DB outage). Log and continue — the row
        // stays undelivered and the next tick will retry per
        // attempts/nextRetryAt backoff.
        this.logger.warn(
          `Outbox row ${row.id} (${row.eventType}) dispatch transaction failed: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }
  }

  private async dispatchOne(
    row: ClaimedOutboxRow,
    tx: Parameters<OutboxRepository['append']>[1],
  ): Promise<void> {
    const handler = this.registry.get(row.eventType);
    if (!handler) {
      // Unknown event types stay undelivered forever — we don't want a
      // typo to silently dead-letter real events. Log loudly and bump
      // attempts so the operator notices the backoff growing.
      await this.repo.markFailed(
        row.id,
        `no handler registered for "${row.eventType}"`,
        row.attempts,
        tx,
      );
      this.logger.warn(
        `Outbox row ${row.id} has no handler for type "${row.eventType}"`,
      );
      return;
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      // Park it. Don't mark delivered, don't keep retrying. Operator action.
      this.logger.error(
        `Outbox row ${row.id} (${row.eventType}) exceeded ${MAX_ATTEMPTS} attempts; parking`,
      );
      await this.repo.markFailed(
        row.id,
        `max attempts (${MAX_ATTEMPTS}) exceeded`,
        row.attempts,
        tx,
      );
      return;
    }

    try {
      await handler(row);
      await this.repo.markDelivered(row.id, tx);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Outbox handler for ${row.eventType} (row ${row.id}) failed: ${msg}`,
      );
      await this.repo.markFailed(row.id, msg, row.attempts, tx);
    }
  }
}
