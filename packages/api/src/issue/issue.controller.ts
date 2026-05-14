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
import { IssueLinkService } from '../issue-link/issue-link.service.js';
import { BulkDeleteIssueUseCase } from './application/bulk-delete-issue.use-case.js';
import { BulkUpdateIssueUseCase } from './application/bulk-update-issue.use-case.js';
import { CreateIssueUseCase } from './application/create-issue.use-case.js';
import { IssueQueryService } from './application/issue-query.service.js';
import { RemoveIssueUseCase } from './application/remove-issue.use-case.js';
import { ReorderIssueUseCase } from './application/reorder-issue.use-case.js';
import { UpdateIssueUseCase } from './application/update-issue.use-case.js';
import type { IssueStatusLiteral } from './application/ports/issue.repository.js';
import { BulkDeleteIssueDto } from './dto/bulk-delete-issue.dto.js';
import { BulkUpdateIssueDto } from './dto/bulk-update-issue.dto.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { QueryIssueDto } from './dto/query-issue.dto.js';
import { ReorderIssueDto } from './dto/reorder-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

/**
 * Issue endpoints — fully migrated. Every route resolves to a Use
 * Case (write) or the Query Service (read). The legacy IssueService
 * has been deleted; this controller is the only entry point.
 */
@ApiTags('Issues')
@ApiBearerAuth()
@Controller('projects/:projectId/issues')
@UseGuards(ProjectMemberGuard)
export class IssueController {
  constructor(
    private readonly createIssue: CreateIssueUseCase,
    private readonly updateIssue: UpdateIssueUseCase,
    private readonly reorderIssue: ReorderIssueUseCase,
    private readonly removeIssue: RemoveIssueUseCase,
    private readonly bulkUpdateIssue: BulkUpdateIssueUseCase,
    private readonly bulkDeleteIssue: BulkDeleteIssueUseCase,
    private readonly query: IssueQueryService,
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
    const { issueIds, ...changes } = dto;
    return this.bulkUpdateIssue.execute({
      projectId,
      actorId: user.sub,
      issueIds,
      changes,
    });
  }

  @Post('bulk-delete')
  bulkDelete(
    @Param('projectId') projectId: string,
    @Body() dto: BulkDeleteIssueDto,
  ) {
    return this.bulkDeleteIssue.execute({
      projectId,
      issueIds: dto.issueIds,
    });
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
    const { silent, labelIds, componentIds, ...rest } = dto;
    return this.updateIssue.execute({
      projectId,
      issueId,
      actorId: user.sub,
      silent,
      changes: { ...rest, labelIds, componentIds },
    });
  }

  @Patch(':issueId/reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Body() body: ReorderIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reorderIssue.execute({
      projectId,
      issueId,
      targetStatus: body.status as IssueStatusLiteral,
      targetOrder: body.order,
      actorId: user.sub,
    });
  }

  @Delete(':issueId')
  remove(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.removeIssue.execute({ projectId, issueId });
  }
}
