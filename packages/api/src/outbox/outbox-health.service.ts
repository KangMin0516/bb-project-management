import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Operator-facing snapshot of outbox health. Surfaced via the
 *  superuser-only `/admin/outbox/health` endpoint. */
export interface OutboxHealthSnapshot {
  pendingCount: number;
  /** Rows whose attempts have hit the publisher's MAX_ATTEMPTS
   *  ceiling — effectively dead-lettered until an operator replays
   *  or deletes them. */
  parkedCount: number;
  /** Oldest pending row's age in seconds. `null` when none pending. */
  oldestPendingAgeSeconds: number | null;
  /** Number of distinct registered event types in the table (helps
   *  catch typo-driven unknowns vs intended types). */
  pendingByType: { eventType: string; count: number }[];
  /** Recent failures — pending rows that have failed at least once,
   *  ordered by attempts desc. Operator inspects payload + lastError
   *  to decide replay vs delete. */
  recentFailures: {
    id: string;
    eventType: string;
    aggregateId: string;
    attempts: number;
    lastError: string | null;
    nextRetryAt: Date;
  }[];
}

const PARKED_ATTEMPT_THRESHOLD = 8;

@Injectable()
export class OutboxHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(): Promise<OutboxHealthSnapshot> {
    const [
      pendingCount,
      parkedCount,
      oldestPending,
      pendingByType,
      recentFailures,
    ] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { deliveredAt: null } }),
      this.prisma.outboxEvent.count({
        where: {
          deliveredAt: null,
          attempts: { gte: PARKED_ATTEMPT_THRESHOLD },
        },
      }),
      this.prisma.outboxEvent.findFirst({
        where: { deliveredAt: null },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      }),
      this.prisma.outboxEvent.groupBy({
        by: ['eventType'],
        where: { deliveredAt: null },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
      }),
      this.prisma.outboxEvent.findMany({
        where: { deliveredAt: null, attempts: { gt: 0 } },
        orderBy: [{ attempts: 'desc' }, { nextRetryAt: 'asc' }],
        take: 20,
        select: {
          id: true,
          eventType: true,
          aggregateId: true,
          attempts: true,
          lastError: true,
          nextRetryAt: true,
        },
      }),
    ]);

    return {
      pendingCount,
      parkedCount,
      oldestPendingAgeSeconds: oldestPending
        ? Math.floor((Date.now() - oldestPending.occurredAt.getTime()) / 1000)
        : null,
      pendingByType: pendingByType.map((r) => ({
        eventType: r.eventType,
        count: r._count,
      })),
      recentFailures,
    };
  }
}
