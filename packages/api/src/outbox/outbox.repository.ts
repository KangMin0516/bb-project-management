import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DomainEvent } from './domain-event.js';

/**
 * `Prisma.TransactionClient` isn't re-exported by the generated module
 * tree in a stable shape, so we model the slice we need (`outboxEvent`,
 * `$queryRaw`) as a structural type. Both the base `PrismaClient` and a
 * `tx` argument inside `$transaction(async (tx) => …)` satisfy it.
 */
type TxOrClient = Pick<PrismaClient, 'outboxEvent' | '$queryRaw'>;

export interface ClaimedOutboxRow {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  attempts: number;
  occurredAt: Date;
}

const MAX_RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour cap
const BASE_RETRY_DELAY_MS = 60 * 1000; // 60 s

/**
 * Outbox DB ops. Stateless — instantiate as @Injectable so PrismaService
 * is DI-injected, but every method takes an optional `tx` so callers can
 * append events inside the same transaction as their business write.
 */
@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append an event. Pass `tx` to atomically include this with a
   * business write — that's the whole point of the outbox pattern.
   */
  async append(event: DomainEvent, tx?: TxOrClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.create({
      data: {
        eventType: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as object,
        // `next_retry_at` defaults to now(); override only when the
        // event opts into a grace period.
        ...(event.deliverAfter ? { nextRetryAt: event.deliverAfter } : {}),
      },
    });
  }

  /**
   * Claim a batch of undelivered, due-now rows using `FOR UPDATE SKIP
   * LOCKED` so multiple publisher replicas don't compete for the same
   * row. Caller must wrap call + handler dispatch in a single
   * transaction so the lock is released only after mark.
   */
  async claimBatch(tx: TxOrClient, limit = 50): Promise<ClaimedOutboxRow[]> {
    return tx.$queryRaw<ClaimedOutboxRow[]>`
      SELECT
        id,
        event_type      AS "eventType",
        aggregate_type  AS "aggregateType",
        aggregate_id    AS "aggregateId",
        payload,
        attempts,
        occurred_at     AS "occurredAt"
      FROM outbox_events
      WHERE delivered_at IS NULL
        AND next_retry_at <= now()
      ORDER BY sequence_no
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  }

  /**
   * Hard-delete any undelivered rows matching the given selector. Used
   * by "cancel" flows where a scheduled side-effect must be revoked
   * before its delivery window (vs leaving the row and skipping at
   * deliver time via state-check). Already-delivered rows are
   * untouched — delivery is at-least-once, never un-done after the fact.
   *
   * Returns the count of removed rows.
   */
  async deleteUndelivered(
    selector: {
      eventType: string;
      aggregateType: string;
      aggregateId: string;
    },
    tx?: TxOrClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.outboxEvent.deleteMany({
      where: {
        eventType: selector.eventType,
        aggregateType: selector.aggregateType,
        aggregateId: selector.aggregateId,
        deliveredAt: null,
      },
    });
    return result.count;
  }

  async markDelivered(id: string, tx?: TxOrClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.update({
      where: { id },
      data: { deliveredAt: new Date() },
    });
  }

  /**
   * Bump attempts + compute next retry. Backoff: `min(60s * 2^attempts,
   * 1h)`. The publisher decides to give up after a hard ceiling
   * (see OutboxPublisher.MAX_ATTEMPTS) — this repo just records.
   */
  async markFailed(
    id: string,
    error: string,
    currentAttempts: number,
    tx?: TxOrClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const delay = nextBackoffMs(currentAttempts);
    await client.outboxEvent.update({
      where: { id },
      data: {
        attempts: currentAttempts + 1,
        lastError: error.slice(0, 1000), // bound size on column
        nextRetryAt: new Date(Date.now() + delay),
      },
    });
  }
}

export function nextBackoffMs(currentAttempts: number): number {
  const delay = BASE_RETRY_DELAY_MS * 2 ** currentAttempts;
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}
