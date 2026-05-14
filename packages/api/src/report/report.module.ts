import { Module, type OnModuleInit } from '@nestjs/common';
import { SlackModule } from '../slack/slack.module.js';
import { OutboxHandlerRegistry } from '../outbox/outbox-handler.registry.js';
import type { ClaimedOutboxRow } from '../outbox/outbox.repository.js';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';
import { ReportScheduler, DAILY_REPORT_EVENT } from './report.scheduler.js';
import { MgmtDigestService } from './mgmt-digest.service.js';

@Module({
  imports: [SlackModule],
  controllers: [ReportController],
  providers: [ReportService, ReportScheduler, MgmtDigestService],
  exports: [ReportService],
})
export class ReportModule implements OnModuleInit {
  constructor(
    private readonly registry: OutboxHandlerRegistry,
    private readonly scheduler: ReportScheduler,
  ) {}

  onModuleInit(): void {
    this.registry.register(DAILY_REPORT_EVENT, (row: ClaimedOutboxRow) =>
      this.scheduler.handleDailyReportTrigger(
        row.payload as Parameters<
          ReportScheduler['handleDailyReportTrigger']
        >[0],
      ),
    );
  }
}
