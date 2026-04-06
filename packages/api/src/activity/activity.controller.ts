import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Activities')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(ProjectMemberGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get('activities')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.findByProject(projectId, page, limit);
  }

  @Get('issues/:issueId/activities')
  findByIssue(
    @Param('issueId') issueId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.findByIssue(issueId, page, limit);
  }
}
