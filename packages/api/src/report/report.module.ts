import { Module } from '@nestjs/common';
import { SlackModule } from '../slack/slack.module.js';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';
import { ReportScheduler } from './report.scheduler.js';

@Module({
  imports: [SlackModule],
  controllers: [ReportController],
  providers: [ReportService, ReportScheduler],
  exports: [ReportService],
})
export class ReportModule {}
