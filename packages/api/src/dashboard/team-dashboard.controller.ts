import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
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

  @Get('member/:userId/issues')
  getMemberIssues(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.dashboardService.getMemberIssues(userId);
  }

  @Get('member/:userId/detail')
  getMemberDetail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.dashboardService.getMemberDetail(userId);
  }
}
