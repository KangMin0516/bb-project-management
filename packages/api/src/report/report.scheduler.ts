import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportService } from './report.service.js';
import { MgmtDigestService } from './mgmt-digest.service.js';

@Injectable()
export class ReportScheduler {
  private readonly logger = new Logger(ReportScheduler.name);

  constructor(
    private prisma: PrismaService,
    private reportService: ReportService,
    private mgmtDigestService: MgmtDigestService,
  ) {}

  @Cron('0 * * * * *') // Every minute at :00
  async checkAndSendReports() {
    const configs = await this.prisma.dailyReportConfig.findMany({
      where: { enabled: true },
    });

    for (const config of configs) {
      try {
        await this.processConfig(config);
      } catch (err) {
        this.logger.error(
          `Failed to process report config ${config.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async processConfig(config: {
    id: string;
    projectId: string;
    timezone: string;
    skipWeekends: boolean;
    morningTime: string;
    morningChannelId: string | null;
    morningLastSent: Date | null;
    lunchTime: string;
    lunchChannelId: string | null;
    lunchLastSent: Date | null;
    eveningTime: string;
    eveningChannelId: string | null;
    eveningLastSent: Date | null;
  }) {
    // Get current time in config timezone
    const now = new Date();
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // Parse HH:mm from formatted string
    const currentHHMM = localTime.replace(/\u202f/g, '').trim();

    // Check weekend
    if (config.skipWeekends) {
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: config.timezone,
        weekday: 'short',
      });
      const dayStr = dayFormatter.format(now);
      if (dayStr === 'Sat' || dayStr === 'Sun') {
        return;
      }
    }

    // Get today's date string in the config timezone for dedup
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = dateFormatter.format(now); // YYYY-MM-DD

    // Check each report time
    const reports: Array<{
      type: 'morning' | 'lunch' | 'evening';
      time: string;
      channelId: string | null;
      lastSent: Date | null;
      lastSentField: string;
    }> = [
      {
        type: 'morning',
        time: config.morningTime,
        channelId: config.morningChannelId,
        lastSent: config.morningLastSent,
        lastSentField: 'morningLastSent',
      },
      {
        type: 'lunch',
        time: config.lunchTime,
        channelId: config.lunchChannelId,
        lastSent: config.lunchLastSent,
        lastSentField: 'lunchLastSent',
      },
      {
        type: 'evening',
        time: config.eveningTime,
        channelId: config.eveningChannelId,
        lastSent: config.eveningLastSent,
        lastSentField: 'eveningLastSent',
      },
    ];

    for (const report of reports) {
      if (!report.channelId) continue;
      if (currentHHMM !== report.time) continue;

      // Dedup: check if already sent today for this time
      if (report.lastSent) {
        const lastSentDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: config.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(report.lastSent);

        const lastSentTime = new Intl.DateTimeFormat('en-US', {
          timeZone: config.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
          .format(report.lastSent)
          .replace(/\u202f/g, '')
          .trim();

        if (lastSentDate === todayStr && lastSentTime === report.time) {
          continue; // Already sent
        }
      }

      this.logger.log(
        `Sending ${report.type} report for project ${config.projectId}`,
      );

      try {
        await this.reportService.sendReport(config.projectId, report.type);

        // Update lastSent
        await this.prisma.dailyReportConfig.update({
          where: { id: config.id },
          data: { [report.lastSentField]: now },
        });
      } catch (err) {
        this.logger.error(
          `Failed to send ${report.type} report for project ${config.projectId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  // ─── Management Digest ────────────────────────────────────

  @Cron('0 30 7 * * 1-5', { timeZone: 'Asia/Seoul' })
  async sendMorningDigest() {
    try {
      await this.mgmtDigestService.sendDigest('morning');
    } catch (err) {
      this.logger.error(
        'Failed to send morning management digest',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron('0 30 17 * * 1-5', { timeZone: 'Asia/Seoul' })
  async sendEveningDigest() {
    try {
      await this.mgmtDigestService.sendDigest('evening');
    } catch (err) {
      this.logger.error(
        'Failed to send evening management digest',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
