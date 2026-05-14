import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

const RETENTION_DAYS = 30;

/**
 * Prunes delivered outbox rows older than 30 days. Without this the
 * table grows unbounded — every assignee change, every join-request
 * fans out a row that stays forever.
 *
 * The retention window is generous on purpose: it leaves enough
 * history for incident forensics (what was scheduled / when) while
 * cleaning up before the table interferes with index scans.
 *
 * Runs at 03:00 UTC daily — outside business hours for the BB
 * deployment (Korea timezone) and avoids the morning standup cron.
 */
@Injectable()
export class OutboxRetentionScheduler {
  private readonly logger = new Logger(OutboxRetentionScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 3 * * *')
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.outboxEvent.deleteMany({
      where: {
        deliveredAt: { lt: cutoff, not: null },
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `Pruned ${result.count} delivered outbox rows older than ${RETENTION_DAYS} days`,
      );
    } else {
      this.logger.debug(
        `No outbox rows to prune (retention=${RETENTION_DAYS}d)`,
      );
    }
  }
}
