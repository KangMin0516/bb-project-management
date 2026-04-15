import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { CurrentUser } from '../common/decorators/index.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class GlobalDashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('my')
  getMyDashboard(@CurrentUser('sub') userId: string) {
    return this.dashboardService.getMyGlobalDashboard(userId);
  }
}
