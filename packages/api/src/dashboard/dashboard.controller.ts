import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectMetricsQueryService } from './project-metrics-query.service.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { CurrentUser } from '../common/decorators/index.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('projects/:projectId/dashboard')
@UseGuards(ProjectMemberGuard)
export class DashboardController {
  constructor(private readonly projectMetrics: ProjectMetricsQueryService) {}

  @Get()
  getStats(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectMetrics.getProjectStats(projectId, userId);
  }
}
