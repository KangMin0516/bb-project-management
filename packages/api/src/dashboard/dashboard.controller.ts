import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { CurrentUser } from '../common/decorators/index.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('projects/:projectId/dashboard')
@UseGuards(ProjectMemberGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getStats(
    @Param('projectId') projectId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.dashboardService.getProjectStats(projectId, userId);
  }
}
