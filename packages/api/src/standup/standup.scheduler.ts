import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutboxEventBus } from '../outbox/outbox-event-bus.js';
import { StandupService } from './standup.service.js';

/** Routing key for the catch-up-capable standup trigger. */
export const STANDUP_TRIGGER_EVENT = 'StandupTrigger';

interface StandupTriggerPayload {
  configId: string;
  /** ISO of the scheduled fire time — handler uses for logging only. */
  scheduledFor: string;
}

@Injectable()
export class StandupScheduler {
  private readonly logger = new Logger(StandupScheduler.name);

  constructor(
    private prisma: PrismaService,
    private standupService: StandupService,
    private outboxBus: OutboxEventBus,
  ) {}

  @Cron('0 */5 * * * *') // Every 5 minutes — check for overdue reminders
  async checkReminders() {
    try {
      await this.standupService.remindUnanswered();
    } catch (err) {
      this.logger.error(
        'Failed to check reminders',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Per-minute planner. For each enabled standup config:
   *   1. Compute today's scheduled fire time in the config timezone.
   *   2. If `now >= scheduledTime` and we haven't triggered for today
   *      yet, enqueue an outbox event and stamp `lastTriggeredAt`.
   *
   * The outbox publisher delivers the event via the registered handler
   * (`StandupService.triggerStandup`). When the API process is down
   * during the scheduled minute, the next per-minute tick after
   * recovery still satisfies the catch-up condition, so the standup
   * fires (late, but not lost). Same-minute double-firing is prevented
   * by the `lastTriggeredAt = startOfToday(tz)` guard.
   */
  @Cron('0 * * * * *')
  async checkAndQueueStandups() {
    const configs = await this.prisma.standupConfig.findMany({
      where: { enabled: true },
    });

    for (const config of configs) {
      try {
        await this.queueIfDue(config);
      } catch (err) {
        this.logger.error(
          `Failed to queue standup ${config.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async queueIfDue(config: {
    id: string;
    name: string;
    timezone: string;
    cronHour: string;
    cronMinute: string;
    cronDayOfWeek: string;
    lastTriggeredAt: Date | null;
  }): Promise<void> {
    const now = new Date();

    // Day-of-week gate in the config timezone.
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      weekday: 'short',
    });
    const dayNum = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(
      dayFormatter.format(now).toLowerCase(),
    );
    if (!matchesCronField(config.cronDayOfWeek, dayNum)) return;

    // We only support single-value hour / minute fields (not lists or
    // ranges) for the scheduled fire time — historically the UI only
    // allowed one value per slot. Lists/ranges still work for
    // dayOfWeek above because matchesCronField handles them.
    const targetHour = parseInt(config.cronHour, 10);
    const targetMinute = parseInt(config.cronMinute, 10);
    if (Number.isNaN(targetHour) || Number.isNaN(targetMinute)) {
      this.logger.warn(
        `Config ${config.id} has non-numeric hour/minute (${config.cronHour}:${config.cronMinute}) — skipping`,
      );
      return;
    }

    // Compute the date string for "today in tz" — used to decide
    // whether `lastTriggeredAt` already covers today.
    const todayStr = formatDateInTz(now, config.timezone);
    const lastStr = config.lastTriggeredAt
      ? formatDateInTz(config.lastTriggeredAt, config.timezone)
      : null;
    if (lastStr === todayStr) return; // Already fired today.

    // Compute the actual scheduled instant in UTC. Use Intl trick:
    // build a Date as if naive UTC then shift by the tz offset for
    // that moment. Avoids needing a tz library for this small case.
    const scheduledInstant = scheduledTodayInTz(
      now,
      config.timezone,
      targetHour,
      targetMinute,
    );
    if (now < scheduledInstant) return; // Not yet due.

    // Atomic claim — set lastTriggeredAt only if not already set for
    // today. Concurrent scheduler ticks lose the race; only the
    // winner enqueues the event.
    const claimed = await this.claimToday(config.id, scheduledInstant);
    if (!claimed) return;

    const payload: StandupTriggerPayload = {
      configId: config.id,
      scheduledFor: scheduledInstant.toISOString(),
    };
    await this.outboxBus.publish({
      type: STANDUP_TRIGGER_EVENT,
      aggregateType: 'StandupConfig',
      aggregateId: config.id,
      payload,
    });

    this.logger.log(
      `Queued standup ${config.name} for ${scheduledInstant.toISOString()}`,
    );
  }

  /**
   * Atomically set `lastTriggeredAt = scheduledInstant` only when the
   * existing value is null or older than the start of today in the
   * config's local date. Returns true if we won the race.
   */
  private async claimToday(
    configId: string,
    scheduledInstant: Date,
  ): Promise<boolean> {
    const result = await this.prisma.standupConfig.updateMany({
      where: {
        id: configId,
        OR: [
          { lastTriggeredAt: null },
          { lastTriggeredAt: { lt: scheduledInstant } },
        ],
      },
      data: { lastTriggeredAt: scheduledInstant },
    });
    return result.count > 0;
  }

  /**
   * Handler invoked by the outbox publisher. Resolves the config and
   * actually fires the standup. State-check idempotency: skip if the
   * config is no longer enabled or no longer exists.
   */
  async handleStandupTrigger(payload: StandupTriggerPayload): Promise<void> {
    const config = await this.prisma.standupConfig.findUnique({
      where: { id: payload.configId },
      select: { id: true, enabled: true, name: true },
    });
    if (!config) {
      this.logger.debug(
        `Skipping standup trigger — config ${payload.configId} no longer exists`,
      );
      return;
    }
    if (!config.enabled) {
      this.logger.debug(
        `Skipping standup trigger — config ${config.name} is disabled`,
      );
      return;
    }
    await this.standupService.triggerStandup(payload.configId);
  }
}

/** YYYY-MM-DD as observed in the given timezone. */
function formatDateInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns the Date instance representing `targetHour:targetMinute`
 * local-time in `timeZone` on the same local calendar day as `now`.
 *
 * Treat the target wall clock as UTC, then shift by the timezone offset
 * to get the real UTC instant. For a fixed-offset zone (Asia/Ho_Chi_Minh,
 * Asia/Seoul) one pass converges exactly. For DST zones a second pass
 * realigns if the first pass crossed a transition.
 *
 * Mirrors `report/report.scheduler.ts:scheduledTodayInTz` — keep them in
 * sync if you tweak either.
 */
export function scheduledTodayInTz(
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

  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, targetHour, targetMinute, 0),
  );
  const offsetMs = tzOffsetAt(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - offsetMs);
  const offsetMs2 = tzOffsetAt(firstPass, timeZone);
  if (offsetMs2 === offsetMs) return firstPass;
  return new Date(utcGuess.getTime() - offsetMs2);
}

/** Returns the offset (ms) such that `localWallClock = utc + offset`. */
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

function matchesCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  const parts = field.split(',');
  for (const part of parts) {
    if (part.includes('-')) {
      const [min, max] = part.split('-').map(Number);
      if (value >= min && value <= max) return true;
    } else {
      if (parseInt(part, 10) === value) return true;
    }
  }
  return false;
}
