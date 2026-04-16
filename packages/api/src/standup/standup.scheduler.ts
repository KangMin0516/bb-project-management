import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { StandupService } from './standup.service.js';

@Injectable()
export class StandupScheduler {
  private readonly logger = new Logger(StandupScheduler.name);

  constructor(
    private prisma: PrismaService,
    private standupService: StandupService,
  ) {}

  @Cron('0 * * * * *') // Every minute at :00
  async checkAndTriggerStandups() {
    const configs = await this.prisma.standupConfig.findMany({
      where: { enabled: true },
    });

    for (const config of configs) {
      try {
        await this.processConfig(config);
      } catch (err) {
        this.logger.error(
          `Failed to process standup config ${config.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async processConfig(config: {
    id: string;
    name: string;
    timezone: string;
    cronHour: string;
    cronMinute: string;
    cronDayOfWeek: string;
    lastTriggeredAt: Date | null;
  }) {
    const now = new Date();

    // Get current time in config timezone
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      hour: '2-digit',
      hour12: false,
    })
      .format(now)
      .replace(/\u202f/g, '')
      .trim();

    const minuteStr = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      minute: '2-digit',
    })
      .format(now)
      .replace(/\u202f/g, '')
      .trim();

    const currentHour = parseInt(hourStr, 10);
    const currentMinute = parseInt(minuteStr, 10);

    // Check day of week
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      weekday: 'short',
    });
    const dayStr = dayFormatter.format(now).toLowerCase();
    const dayNum = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(
      dayStr,
    );

    if (!this.matchesCronField(config.cronDayOfWeek, dayNum)) return;
    if (!this.matchesCronField(config.cronHour, currentHour)) return;
    if (!this.matchesCronField(config.cronMinute, currentMinute)) return;

    // Dedup: check if already triggered today at this time
    if (config.lastTriggeredAt) {
      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: config.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = dateFormatter.format(now);
      const lastStr = dateFormatter.format(config.lastTriggeredAt);

      if (todayStr === lastStr) {
        const lastHour = parseInt(
          new Intl.DateTimeFormat('en-US', {
            timeZone: config.timezone,
            hour: '2-digit',
            hour12: false,
          })
            .format(config.lastTriggeredAt)
            .replace(/\u202f/g, '')
            .trim(),
          10,
        );
        const lastMinute = parseInt(
          new Intl.DateTimeFormat('en-US', {
            timeZone: config.timezone,
            minute: '2-digit',
          })
            .format(config.lastTriggeredAt)
            .replace(/\u202f/g, '')
            .trim(),
          10,
        );

        if (lastHour === currentHour && lastMinute === currentMinute) {
          return; // Already triggered
        }
      }
    }

    this.logger.log(`Triggering standup: ${config.name}`);
    await this.standupService.triggerStandup(config.id);
  }

  /**
   * Match a cron-style field value.
   * Supports: "*", single number "9", range "1-5", comma-separated "1,3,5"
   */
  private matchesCronField(field: string, value: number): boolean {
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
}
