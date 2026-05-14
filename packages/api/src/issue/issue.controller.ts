import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssueService } from './issue.service.js';
import { IssueLinkService } from '../issue-link/issue-link.service.js';
import { CreateIssueUseCase } from './application/create-issue.use-case.js';
import { IssueQueryService } from './application/issue-query.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { QueryIssueDto } from './dto/query-issue.dto.js';
import { ReorderIssueDto } from './dto/reorder-issue.dto.js';
import { BulkUpdateIssueDto } from './dto/bulk-update-issue.dto.js';
import { BulkDeleteIssueDto } from './dto/bulk-delete-issue.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

/**
 * Issue endpoints. Phase 1 of the M3 migration routes:
 *   - POST /                    → CreateIssueUseCase
 *   - GET, GET /board, GET /:id → IssueQueryService
 * Update / reorder / bulk / delete still call the legacy
 * IssueService until subsequent phases migrate those flows.
 */
@ApiTags('Issues')
@ApiBearerAuth()
@Controller('projects/:projectId/issues')
@UseGuards(ProjectMemberGuard)
export class IssueController {
  constructor(
    private readonly createIssue: CreateIssueUseCase,
    private readonly query: IssueQueryService,
    private readonly issueService: IssueService,
    private readonly issueLinkService: IssueLinkService,
  ) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.createIssue.execute({
      projectId,
      creatorId: user.sub,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      status: dto.status,
      priority: dto.priority,
      parentId: dto.parentId,
      assigneeId: dto.assigneeId,
      reviewerAssigneeId: dto.reviewerAssigneeId,
      startDate: dto.startDate,
      dueDate: dto.dueDate,
      labelIds: dto.labelIds,
      componentIds: dto.componentIds,
    });
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryIssueDto,
  ) {
    return this.query.findAll(projectId, query);
  }

  @Get('board')
  board(
    @Param('projectId') projectId: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.query.findByStatus(projectId, includeArchived === 'true');
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
  async findOne(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    const issue = await this.query.findOne(projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
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
