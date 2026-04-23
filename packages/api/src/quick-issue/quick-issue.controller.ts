import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { QuickIssueService } from './quick-issue.service.js';
import { QuickCreateIssueDto } from './dto/quick-create-issue.dto.js';
import { CreateIssueFromPreviewDto } from './dto/create-issue-from-preview.dto.js';

@ApiTags('Quick Issue')
@ApiBearerAuth()
@Controller('quick-issue')
export class QuickIssueController {
  constructor(private quickIssueService: QuickIssueService) {}

  @Post('parse')
  async parse(
    @Body() dto: QuickCreateIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.quickIssueService.parse(dto.text, user.sub, dto.projectId);
  }

  @Post('create')
  async create(
    @Body() dto: CreateIssueFromPreviewDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.quickIssueService.create(dto, user.sub);
  }
}
