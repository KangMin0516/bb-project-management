import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssueLinkService } from './issue-link.service.js';
import { CreateIssueLinkDto } from './dto/create-issue-link.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Issue Links')
@ApiBearerAuth()
@Controller('projects/:projectId/issues/:issueId/links')
@UseGuards(ProjectMemberGuard)
export class IssueLinkController {
  constructor(private issueLinkService: IssueLinkService) {}

  @Post()
  create(
    @Param('issueId') issueId: string,
    @Body() dto: CreateIssueLinkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.issueLinkService.create(issueId, dto, user.sub);
  }

  @Get()
  findByIssue(@Param('issueId') issueId: string) {
    return this.issueLinkService.findByIssue(issueId);
  }

  @Delete(':linkId')
  remove(@Param('linkId') linkId: string, @CurrentUser() user: JwtPayload) {
    return this.issueLinkService.remove(linkId, user.sub);
  }
}
