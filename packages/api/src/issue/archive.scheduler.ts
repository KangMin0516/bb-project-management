import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ArchiveScheduler {
  private readonly logger = new Logger(ArchiveScheduler.name);
  private static readonly ARCHIVE_AFTER_DAYS = 3;

  constructor(private prisma: PrismaService) {}

  /** Every day at 03:00 — archive DONE/CANCELED issues older than 3 days */
  @Cron('0 0 3 * * *')
  async archiveOldIssues() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - ArchiveScheduler.ARCHIVE_AFTER_DAYS);

      const result = await this.prisma.issue.updateMany({
        where: {
          status: { in: ['DONE', 'CANCELED'] },
          archivedAt: null,
          updatedAt: { lt: cutoff },
        },
        data: { archivedAt: new Date() },
      });

      if (result.count > 0) {
        this.logger.log(
          `Archived ${result.count} issues (DONE/CANCELED > ${ArchiveScheduler.ARCHIVE_AFTER_DAYS} days)`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to archive old issues',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
