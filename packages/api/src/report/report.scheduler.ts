import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutboxEventBus } from '../outbox/outbox-event-bus.js';
import { ReportService } from './report.service.js';
import { MgmtDigestService } from './mgmt-digest.service.js';

/** Routing key for the catch-up-capable daily report. */
export const DAILY_REPORT_EVENT = 'DailyReportTrigger';

export type ReportSlot = 'morning' | 'lunch' | 'evening';

interface DailyReportPayload {
  projectId: string;
  configId: string;
  slot: ReportSlot;
  scheduledFor: string;
}

@Injectable()
export class ReportScheduler {
  private readonly logger = new Logger(ReportScheduler.name);

  constructor(
    private prisma: PrismaService,
    private reportService: ReportService,
    private mgmtDigestService: MgmtDigestService,
    private outboxBus: OutboxEventBus,
  ) {}

  /**
   * Per-minute planner. For each enabled report config, enqueue
   * outbox events for any of the three slots whose scheduled time
   * has passed and which hasn't fired today yet.
   *
   * Survives process downtime: when the next tick after recovery
   * sees `now > scheduledTime` and `*LastSent` is still pre-today,
   * it enqueues normally. The outbox publisher fires the handler
   * which posts to Slack — late but not missed.
   */
  @Cron('0 * * * * *')
  async checkAndQueueReports() {
    const configs = await this.prisma.dailyReportConfig.findMany({
      where: { enabled: true },
    });

    for (const config of configs) {
      try {
        await this.queueIfDue(config);
      } catch (err) {
        this.logger.error(
          `Failed to queue report for project ${config.projectId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async queueIfDue(config: {
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
  }): Promise<void> {
    const now = new Date();

    if (config.skipWeekends) {
      const dayStr = new Intl.DateTimeFormat('en-US', {
        timeZone: config.timezone,
        weekday: 'short',
      }).format(now);
      if (dayStr === 'Sat' || dayStr === 'Sun') return;
    }

    const slots: Array<{
      slot: ReportSlot;
      time: string;
      channelId: string | null;
      lastSent: Date | null;
      lastSentField: 'morningLastSent' | 'lunchLastSent' | 'eveningLastSent';
    }> = [
      {
        slot: 'morning',
        time: config.morningTime,
        channelId: config.morningChannelId,
        lastSent: config.morningLastSent,
        lastSentField: 'morningLastSent',
      },
      {
        slot: 'lunch',
        time: config.lunchTime,
        channelId: config.lunchChannelId,
        lastSent: config.lunchLastSent,
        lastSentField: 'lunchLastSent',
      },
      {
        slot: 'evening',
        time: config.eveningTime,
        channelId: config.eveningChannelId,
        lastSent: config.eveningLastSent,
        lastSentField: 'eveningLastSent',
      },
    ];

    const todayStr = formatDateInTz(now, config.timezone);

    for (const s of slots) {
      if (!s.channelId) continue;

      const [hourStr, minuteStr] = s.time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

      const lastStr = s.lastSent
        ? formatDateInTz(s.lastSent, config.timezone)
        : null;
      if (lastStr === todayStr) continue;

      const scheduledInstant = scheduledTodayInTz(
        now,
        config.timezone,
        hour,
        minute,
      );
      if (now < scheduledInstant) continue;

      const claimed = await this.claimSlot(
        config.id,
        s.lastSentField,
        scheduledInstant,
      );
      if (!claimed) continue;

      const payload: DailyReportPayload = {
        projectId: config.projectId,
        configId: config.id,
        slot: s.slot,
        scheduledFor: scheduledInstant.toISOString(),
      };
      await this.outboxBus.publish({
        type: DAILY_REPORT_EVENT,
        aggregateType: 'DailyReportConfig',
        aggregateId: config.id,
        payload,
      });

      this.logger.log(
        `Queued ${s.slot} report for project ${config.projectId} at ${scheduledInstant.toISOString()}`,
      );
    }
  }

  private async claimSlot(
    configId: string,
    field: 'morningLastSent' | 'lunchLastSent' | 'eveningLastSent',
    scheduledInstant: Date,
  ): Promise<boolean> {
    const result = await this.prisma.dailyReportConfig.updateMany({
      where: {
        id: configId,
        OR: [{ [field]: null }, { [field]: { lt: scheduledInstant } }],
      },
      data: { [field]: scheduledInstant },
    });
    return result.count > 0;
  }

  /** Outbox handler. */
  async handleDailyReportTrigger(payload: DailyReportPayload): Promise<void> {
    const config = await this.prisma.dailyReportConfig.findUnique({
      where: { id: payload.configId },
      select: { enabled: true },
    });
    if (!config || !config.enabled) {
      this.logger.debug(
        `Skipping ${payload.slot} report for ${payload.projectId} — config disabled/missing`,
      );
      return;
    }
    await this.reportService.sendReport(payload.projectId, payload.slot);
  }

  // ─── Management Digest ────────────────────────────────────
  // Kept on plain @Cron — less critical than per-project reports.
  // If the process misses these ticks, the next day's digest still
  // fires; PMs can pull the dashboard for the missed day.

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

function formatDateInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function scheduledTodayInTz(
  now: Date,
  timeZone: string,
  targetHour: number,
  targetMinute: number,
): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  const year = parseInt(lookup.year, 10);
  const month = parseInt(lookup.month, 10);
  const day = parseInt(lookup.day, 10);

  // Treat the target wall clock as UTC, then shift by the timezone
  // offset to get the real UTC instant. For a constant-offset zone
  // (Asia/Ho_Chi_Minh, Asia/Seoul) one pass converges exactly. For DST
  // zones a second pass realigns if the offset crossed a transition.
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, targetHour, targetMinute, 0),
  );
  const offsetMs = tzOffsetAt(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offsetMs);
  const offsetMs2 = tzOffsetAt(firstPass, timeZone);
  if (offsetMs2 === offsetMs) return firstPass;
  return new Date(utcGuess.getTime() - offsetMs2);
}

function tzOffsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  const localUtcMs = Date.UTC(
    parseInt(lookup.year, 10),
    parseInt(lookup.month, 10) - 1,
    parseInt(lookup.day, 10),
    parseInt(lookup.hour, 10) % 24,
    parseInt(lookup.minute, 10),
    parseInt(lookup.second, 10),
  );
  return localUtcMs - instant.getTime();
}
