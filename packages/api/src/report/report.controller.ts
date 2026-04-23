import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service.js';
import { UpdateReportConfigDto } from './dto/update-report-config.dto.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

interface RequestWithMember {
  projectMember?: { role: string };
  isSuperuser?: boolean;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('projects/:projectId/report-config')
@UseGuards(ProjectMemberGuard)
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get()
  getConfig(@Param('projectId') projectId: string) {
    return this.reportService.getConfig(projectId);
  }

  @Put()
  upsertConfig(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateReportConfigDto,
    @Req() req: RequestWithMember,
  ) {
    this.assertAdmin(req);
    return this.reportService.upsertConfig(projectId, dto);
  }

  @Post('test/:type')
  async testSend(
    @Param('projectId') projectId: string,
    @Param('type') type: string,
    @Req() req: RequestWithMember,
  ) {
    this.assertAdmin(req);
    const validTypes = ['morning', 'lunch', 'evening'] as const;
    if (!validTypes.includes(type as (typeof validTypes)[number])) {
      throw new ForbiddenException('Invalid report type');
    }
    await this.reportService.sendReport(
      projectId,
      type as 'morning' | 'lunch' | 'evening',
    );
    return { sent: true };
  }

  private assertAdmin(req: RequestWithMember) {
    if (req.isSuperuser) return;
    if (req.projectMember?.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only project admins can modify report config',
      );
    }
  }
}
