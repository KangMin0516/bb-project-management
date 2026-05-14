import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TeamMetricsQueryService } from './team-metrics-query.service.js';
import { SuperuserGuard } from '../common/guards/superuser.guard.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(SuperuserGuard)
@Controller('dashboard')
export class TeamDashboardController {
  constructor(private readonly teamMetrics: TeamMetricsQueryService) {}

  @Get('team')
  getTeamDashboard() {
    return this.teamMetrics.getTeamDashboard();
  }

  @Get('team/issues')
  getTeamIssues(@Query('filter') filter: string = 'all') {
    return this.teamMetrics.getTeamIssues(filter);
  }

  @Get('member/:userId/issues')
  getMemberIssues(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.teamMetrics.getMemberIssues(userId);
  }

  @Get('member/:userId/detail')
  getMemberDetail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.teamMetrics.getMemberDetail(userId);
  }
}
