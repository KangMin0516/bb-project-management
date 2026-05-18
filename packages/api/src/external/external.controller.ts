import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ExternalService } from './external.service.js';
import { ExternalCreateIssueDto } from './dto/external-create-issue.dto.js';
import { ExternalUpdateIssueDto } from './dto/external-update-issue.dto.js';
import { ExternalCreateSpecDto } from './dto/external-create-spec.dto.js';
import { ExternalUpdateSpecDto } from './dto/external-update-spec.dto.js';
import { ExternalCreateIssueSpecLinkDto } from './dto/external-create-issue-spec-link.dto.js';
import { ExternalCreateCommentDto } from './dto/external-create-comment.dto.js';
import { ExternalAttachImageDto } from './dto/external-attach-image.dto.js';
import { ApiKeyGuard } from '../api-key/api-key.guard.js';
import {
  Public,
  CurrentUser,
  Source,
  type JwtPayload,
} from '../common/decorators/index.js';
import type { SourceLiteral } from '../common/source.js';

@ApiTags('External API (API Key Auth)')
@ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication' })
@Public() // Skip JWT guard
@UseGuards(ApiKeyGuard) // Use API key auth instead
@Controller('external')
export class ExternalController {
  constructor(private externalService: ExternalService) {}

  @Post('issues')
  createIssue(
    @Body() dto: ExternalCreateIssueDto,
    @CurrentUser() user: JwtPayload,
    @Source() source: SourceLiteral,
  ) {
    return this.externalService.createIssue(dto, user.sub, source);
  }

  @Patch('issues/:projectKey/:issueNumber')
  updateIssue(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() dto: ExternalUpdateIssueDto,
    @CurrentUser() user: JwtPayload,
    @Source() source: SourceLiteral,
  ) {
    return this.externalService.updateIssue(
      projectKey,
      issueNumber,
      dto,
      user.sub,
      source,
    );
  }

  @Get('issues/:projectKey/:issueNumber')
  getIssue(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
  ) {
    return this.externalService.getIssue(projectKey, issueNumber);
  }

  @Get('issues/:projectKey')
  listIssues(
    @Param('projectKey') projectKey: string,
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('assignee') assignee?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('text') text?: string,
    @Query('updatedSince') updatedSince?: string,
    @Query('dueIn') dueIn?: string,
    @Query('hasOverdue') hasOverdue?: string,
    @Query('mode') mode?: string,
    @Query('fields') fields?: string,
  ) {
    const fieldList = fields
      ? fields
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : undefined;
    return this.externalService.listIssues(
      projectKey,
      {
        status,
        page: page ? parseInt(page, 10) || 1 : 1,
        limit: limit ? parseInt(limit, 10) || 20 : 20,
        assignee,
        priority,
        type,
        text,
        updatedSince,
        dueIn,
        hasOverdue: hasOverdue === 'true' || hasOverdue === '1',
        mode: mode === 'summary' ? 'summary' : 'list',
        fields: fieldList,
      },
      user.sub,
    );
  }

  @Get('projects/:projectKey/digest')
  getDigest(
    @Param('projectKey') projectKey: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? parseInt(days, 10) : 7;
    const window =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 90) : 7;
    return this.externalService.getDigest(projectKey, window);
  }

  @Get('projects/:projectKey/specs')
  listSpecs(
    @Param('projectKey') projectKey: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.externalService.listSpecs(projectKey, category, status);
  }

  @Get('projects/:projectKey/specs/:specId')
  getSpec(
    @Param('projectKey') projectKey: string,
    @Param('specId') specId: string,
  ) {
    return this.externalService.getSpec(projectKey, specId);
  }

  @Get('projects/:projectKey/specs/:specId/markdown')
  getSpecMarkdown(
    @Param('projectKey') projectKey: string,
    @Param('specId') specId: string,
  ) {
    return this.externalService.getSpecMarkdown(projectKey, specId);
  }

  @Post('projects/:projectKey/specs')
  createSpec(
    @Param('projectKey') projectKey: string,
    @Body() dto: ExternalCreateSpecDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.externalService.createSpec(projectKey, dto, user.sub);
  }

  @Patch('projects/:projectKey/specs/:specId')
  updateSpec(
    @Param('projectKey') projectKey: string,
    @Param('specId') specId: string,
    @Body() dto: ExternalUpdateSpecDto,
  ) {
    return this.externalService.updateSpec(projectKey, specId, dto);
  }

  @Post('issues/:projectKey/:issueNumber/spec-links')
  createIssueSpecLink(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() dto: ExternalCreateIssueSpecLinkDto,
  ) {
    return this.externalService.createIssueSpecLink(
      projectKey,
      issueNumber,
      dto,
    );
  }

  @Get('issues/:projectKey/:issueNumber/spec-links')
  listIssueSpecLinks(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
  ) {
    return this.externalService.listIssueSpecLinks(projectKey, issueNumber);
  }

  @Delete('issues/:projectKey/:issueNumber/spec-links/:linkId')
  deleteIssueSpecLink(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Param('linkId') linkId: string,
  ) {
    return this.externalService.deleteIssueSpecLink(
      projectKey,
      issueNumber,
      linkId,
    );
  }

  // ─── Phase 1 — endpoints consumed by bbpm-internal-mcp ─────

  @Post('issues/:projectKey/:issueNumber/comments')
  createComment(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() dto: ExternalCreateCommentDto,
    @CurrentUser() user: JwtPayload,
    @Source() source: SourceLiteral,
  ) {
    return this.externalService.createComment(
      projectKey,
      issueNumber,
      dto,
      user.sub,
      source,
    );
  }

  @Get('projects')
  listProjects(@CurrentUser() user: JwtPayload) {
    return this.externalService.listProjectsForUser(user.sub);
  }

  @Get('projects/:projectKey/members')
  listMembers(@Param('projectKey') projectKey: string) {
    return this.externalService.listMembers(projectKey);
  }

  // ─── Phase 2: productivity shortcuts ────────────────────

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.externalService.getMe(user.sub);
  }

  @Get('me/assignments')
  listMyAssignments(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalService.listMyAssignments(user.sub, {
      status,
      limit: limit ? parseInt(limit, 10) || undefined : undefined,
    });
  }

  @Patch('issues/:projectKey/:issueNumber/focus')
  setFocus(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() body: { date?: string | null },
    @CurrentUser() user: JwtPayload,
    @Source() source: SourceLiteral,
  ) {
    // `date` undefined → treat as "set to today"; explicit null clears.
    const date =
      body.date === undefined
        ? new Date().toISOString().slice(0, 10)
        : body.date;
    return this.externalService.setIssueFocus(
      projectKey,
      issueNumber,
      date,
      user.sub,
      source,
    );
  }

  @Post('issues/:projectKey/:issueNumber/archive')
  archiveIssue(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
  ) {
    return this.externalService.archiveIssue(projectKey, issueNumber);
  }

  @Post('issues/:projectKey/:issueNumber/unarchive')
  unarchiveIssue(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
  ) {
    return this.externalService.unarchiveIssue(projectKey, issueNumber);
  }

  @Post('issues/:projectKey/:issueNumber/labels')
  addLabels(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() body: { labels: string[] },
    @CurrentUser() user: JwtPayload,
    @Source() source: SourceLiteral,
  ) {
    return this.externalService.addLabelsToIssue(
      projectKey,
      issueNumber,
      body.labels ?? [],
      user.sub,
      source,
    );
  }

  @Delete('issues/:projectKey/:issueNumber/labels')
  removeLabels(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() body: { labels: string[] },
    @CurrentUser() user: JwtPayload,
    @Source() source: SourceLiteral,
  ) {
    return this.externalService.removeLabelsFromIssue(
      projectKey,
      issueNumber,
      body.labels ?? [],
      user.sub,
      source,
    );
  }

  @Get('projects/:projectKey/labels')
  listLabels(@Param('projectKey') projectKey: string) {
    return this.externalService.listLabels(projectKey);
  }

  @Get('issues/:projectKey/:issueNumber/comments')
  listComments(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalService.listComments(
      projectKey,
      issueNumber,
      page ? parseInt(page, 10) || 1 : 1,
      limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50,
    );
  }

  /**
   * MCP `attach_image_to_issue` — base64 image upload for an existing
   * issue. Avoids multipart so any JSON-only MCP client can attach
   * screenshots without constructing form-data.
   */
  @Post('issues/:projectKey/:issueNumber/attachments')
  attachImage(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() dto: ExternalAttachImageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.externalService.attachImage(
      projectKey,
      issueNumber,
      dto,
      user.sub,
    );
  }

  /**
   * MCP `get_create_rules` — returns the global per-type rule the LLM
   * should follow before calling `create_issue`. Rules are workspace-
   * wide (one row per IssueType across all projects), so this
   * endpoint takes no projectKey. Null when no rule has been
   * configured for the requested type.
   */
  @Get('issue-rules')
  getCreateRules(@Query('type') type?: string) {
    return this.externalService.getCreateRules(type);
  }

  @Get('issues/:projectKey/:issueNumber/activities')
  listActivities(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalService.listActivities(
      projectKey,
      issueNumber,
      page ? parseInt(page, 10) || 1 : 1,
      limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50,
    );
  }
}
