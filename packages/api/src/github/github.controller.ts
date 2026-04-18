import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { GitHubService } from './github.service.js';
import { GitHubWebhookService } from './github-webhook.service.js';
import {
  ConnectGitHubDto,
  UpdateGitHubConfigDto,
  LinkPrDto,
} from './dto/github.dto.js';
import {
  CurrentUser,
  Public,
  type JwtPayload,
} from '../common/decorators/index.js';
import { ProjectMemberGuard } from '../common/guards/project-member.guard.js';

@ApiTags('GitHub')
@Controller('github')
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(
    private githubService: GitHubService,
    private webhookService: GitHubWebhookService,
  ) {}

  @Post('connect')
  @ApiBearerAuth()
  connect(@Body() dto: ConnectGitHubDto, @CurrentUser() user: JwtPayload) {
    return this.githubService.connect(dto, user.sub);
  }

  @Get('status/:projectId')
  @ApiBearerAuth()
  @UseGuards(ProjectMemberGuard)
  getStatus(@Param('projectId') projectId: string) {
    return this.githubService.getStatus(projectId);
  }

  @Delete('disconnect/:projectId')
  @ApiBearerAuth()
  @UseGuards(ProjectMemberGuard)
  disconnect(@Param('projectId') projectId: string) {
    return this.githubService.disconnect(projectId);
  }

  @Patch('config/:projectId')
  @ApiBearerAuth()
  @UseGuards(ProjectMemberGuard)
  updateConfig(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateGitHubConfigDto,
  ) {
    return this.githubService.updateConfig(projectId, dto);
  }

  @Get('repos/:projectId')
  @ApiBearerAuth()
  @UseGuards(ProjectMemberGuard)
  getRepos(@Param('projectId') projectId: string) {
    return this.githubService.getRepos(projectId);
  }

  @Post('link-pr')
  @ApiBearerAuth()
  linkPr(@Body() dto: LinkPrDto) {
    return this.githubService.linkPr(dto);
  }

  @Delete('unlink-pr/:linkId')
  @ApiBearerAuth()
  unlinkPr(@Param('linkId') linkId: string) {
    return this.githubService.unlinkPr(linkId);
  }

  @Post('webhook/:projectId')
  @Public()
  async webhook(
    @Param('projectId') projectId: string,
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request,
  ) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      this.logger.error('rawBody is not available');
      throw new BadRequestException('rawBody is not available');
    }

    return this.webhookService.handleWebhook(
      projectId,
      event,
      signature,
      rawBody,
    );
  }
}
