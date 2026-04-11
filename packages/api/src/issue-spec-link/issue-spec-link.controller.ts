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
import { IssueSpecLinkService } from './issue-spec-link.service.js';
import { CreateIssueSpecLinkDto } from './dto/create-issue-spec-link.dto.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Issue Spec Links')
@ApiBearerAuth()
@Controller('projects/:projectId/issues/:issueId/spec-links')
@UseGuards(ProjectMemberGuard)
export class IssueSpecLinkController {
  constructor(private issueSpecLinkService: IssueSpecLinkService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: CreateIssueSpecLinkDto,
  ) {
    return this.issueSpecLinkService.create(projectId, issueId, dto);
  }

  @Get()
  findByIssue(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.issueSpecLinkService.findByIssue(projectId, issueId);
  }

  @Delete(':linkId')
  remove(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.issueSpecLinkService.remove(projectId, issueId, linkId);
  }
}
