import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { GlobalDashboardController } from './global-dashboard.controller.js';
import { TeamDashboardController } from './team-dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [
    DashboardController,
    GlobalDashboardController,
    TeamDashboardController,
  ],
  providers: [DashboardService],
})
export class DashboardModule {}
