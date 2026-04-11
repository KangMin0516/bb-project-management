import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssueService } from './issue.service.js';
import { IssueLinkService } from '../issue-link/issue-link.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { QueryIssueDto } from './dto/query-issue.dto.js';
import { ReorderIssueDto } from './dto/reorder-issue.dto.js';
import { BulkUpdateIssueDto } from './dto/bulk-update-issue.dto.js';
import { BulkDeleteIssueDto } from './dto/bulk-delete-issue.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('Issues')
@ApiBearerAuth()
@Controller('projects/:projectId/issues')
@UseGuards(ProjectMemberGuard)
export class IssueController {
  constructor(
    private issueService: IssueService,
    private issueLinkService: IssueLinkService,
  ) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.issueService.create(projectId, dto, user.sub);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryIssueDto,
  ) {
    return this.issueService.findAll(projectId, query);
  }

  @Get('board')
  board(@Param('projectId') projectId: string) {
    return this.issueService.findByStatus(projectId);
  }

  @Get('dependencies')
  dependencies(@Param('projectId') projectId: string) {
    return this.issueLinkService.findProjectDependencies(projectId);
  }

  @Patch('bulk')
  bulkUpdate(
    @Param('projectId') projectId: string,
    @Body() dto: BulkUpdateIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.issueService.bulkUpdate(projectId, dto, user.sub);
  }

  @Post('bulk-delete')
  bulkDelete(
    @Param('projectId') projectId: string,
    @Body() dto: BulkDeleteIssueDto,
  ) {
    return this.issueService.bulkDelete(projectId, dto);
  }

  @Get(':issueId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.issueService.findOne(projectId, issueId);
  }

  @Patch(':issueId')
  update(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.issueService.update(projectId, issueId, dto, user.sub);
  }

  @Patch(':issueId/reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: ReorderIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.issueService.reorder(
      projectId,
      issueId,
      body.status,
      body.order,
      user.sub,
    );
  }

  @Delete(':issueId')
  remove(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.issueService.remove(projectId, issueId);
  }
}
