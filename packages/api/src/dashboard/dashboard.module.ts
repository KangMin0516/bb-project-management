import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { GlobalDashboardController } from './global-dashboard.controller.js';
import { ProjectMetricsQueryService } from './project-metrics-query.service.js';
import { TeamDashboardController } from './team-dashboard.controller.js';
import { TeamMetricsQueryService } from './team-metrics-query.service.js';
import { UserMetricsQueryService } from './user-metrics-query.service.js';

/**
 * Dashboard module — split per refactor-plan.md §7.7. The legacy
 * 1137-LOC DashboardService is decomposed into three focused query
 * services, one per audience (project-scoped, cross-project team,
 * personal cross-project). Read-only — CQRS-lite (no domain
 * conversion for query DTOs).
 */
@Module({
  controllers: [
    DashboardController,
    GlobalDashboardController,
    TeamDashboardController,
  ],
  providers: [
    ProjectMetricsQueryService,
    TeamMetricsQueryService,
    UserMetricsQueryService,
  ],
})
export class DashboardModule {}
