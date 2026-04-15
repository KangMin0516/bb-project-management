import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { GlobalDashboardController } from './global-dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [DashboardController, GlobalDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
