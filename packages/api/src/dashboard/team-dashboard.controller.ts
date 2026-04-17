import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { SuperuserGuard } from '../common/guards/superuser.guard.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(SuperuserGuard)
@Controller('dashboard')
export class TeamDashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('team')
  getTeamDashboard() {
    return this.dashboardService.getTeamDashboard();
  }
}
