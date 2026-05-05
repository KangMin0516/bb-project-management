import {
  Body,
  Controller,
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
import { ApiKeyGuard } from '../api-key/api-key.guard.js';
import {
  Public,
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/index.js';

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
  ) {
    return this.externalService.createIssue(dto, user.sub);
  }

  @Patch('issues/:projectKey/:issueNumber')
  updateIssue(
    @Param('projectKey') projectKey: string,
    @Param('issueNumber', ParseIntPipe) issueNumber: number,
    @Body() dto: ExternalUpdateIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.externalService.updateIssue(
      projectKey,
      issueNumber,
      dto,
      user.sub,
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
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalService.listIssues(
      projectKey,
      status,
      page ? parseInt(page, 10) || 1 : 1,
      limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50,
    );
  }

  @Get('projects/:projectKey/digest')
  getDigest(
    @Param('projectKey') projectKey: string,
    @Query('days') days?: string,
  ) {
    const parsed = days ? parseInt(days, 10) : 7;
    const window = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 90) : 7;
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
}
