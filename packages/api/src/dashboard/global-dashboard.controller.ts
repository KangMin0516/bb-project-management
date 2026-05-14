import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserMetricsQueryService } from './user-metrics-query.service.js';
import { CurrentUser } from '../common/decorators/index.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class GlobalDashboardController {
  constructor(private readonly userMetrics: UserMetricsQueryService) {}

  @Get('my')
  getMyDashboard(@CurrentUser('sub') userId: string) {
    return this.userMetrics.getMyGlobalDashboard(userId);
  }
}
