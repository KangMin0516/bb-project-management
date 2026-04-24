import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service.js';
import { MgmtDigestService } from './mgmt-digest.service.js';
import { UpdateReportConfigDto } from './dto/update-report-config.dto.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';
import { SuperuserGuard } from '../common/guards/superuser.guard.js';

interface RequestWithMember {
  projectMember?: { role: string };
  isSuperuser?: boolean;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller()
export class ReportController {
  constructor(
    private reportService: ReportService,
    private mgmtDigestService: MgmtDigestService,
  ) {}

  @Get('projects/:projectId/report-config')
  @UseGuards(ProjectMemberGuard)
  getConfig(@Param('projectId') projectId: string) {
    return this.reportService.getConfig(projectId);
  }

  @Put('projects/:projectId/report-config')
  @UseGuards(ProjectMemberGuard)
  upsertConfig(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateReportConfigDto,
    @Req() req: RequestWithMember,
  ) {
    this.assertAdmin(req);
    return this.reportService.upsertConfig(projectId, dto);
  }

  @Post('projects/:projectId/report-config/test/:type')
  @UseGuards(ProjectMemberGuard)
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

  @Get('reports/digest/test')
  @UseGuards(SuperuserGuard)
  async testDigest(@Query('type') type: string) {
    const validTypes = ['morning', 'evening'] as const;
    if (!validTypes.includes(type as (typeof validTypes)[number])) {
      throw new ForbiddenException(
        'Invalid digest type. Use morning or evening.',
      );
    }
    await this.mgmtDigestService.sendDigest(type as 'morning' | 'evening');
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
