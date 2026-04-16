import { Controller, Get, Delete, Query, Res, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { SlackService } from './slack.service.js';
import {
  CurrentUser,
  Public,
  type JwtPayload,
} from '../common/decorators/index.js';

@ApiTags('Slack')
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private slackService: SlackService,
    private config: ConfigService,
  ) {}

  @Get('install')
  @ApiBearerAuth()
  getInstallUrl(@CurrentUser() user: JwtPayload) {
    const url = this.slackService.getInstallUrl(user.sub);
    return { url };
  }

  @Get('callback')
  @Public()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      await this.slackService.handleCallback(code, state);

      // Redirect to frontend settings page
      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      res.redirect(`${frontendUrl}/settings?slack=connected`);
    } catch (err) {
      this.logger.error('Slack OAuth callback failed', err);
      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      res.redirect(`${frontendUrl}/settings?slack=error`);
    }
  }

  @Get('status')
  @ApiBearerAuth()
  getStatus() {
    return this.slackService.getStatus();
  }

  @Get('channels')
  @ApiBearerAuth()
  async getChannels(@Query('integrationId') integrationId: string) {
    if (!integrationId) {
      return { channels: [] };
    }
    const channels = await this.slackService.getChannels(integrationId);
    return { channels };
  }

  @Get('users')
  @ApiBearerAuth()
  async getUsers(@Query('integrationId') integrationId: string) {
    if (!integrationId) {
      return { users: [] };
    }
    const users = await this.slackService.getUsers(integrationId);
    return { users };
  }

  @Delete('disconnect')
  @ApiBearerAuth()
  async disconnect(@Query('integrationId') integrationId: string) {
    await this.slackService.disconnect(integrationId);
    return { disconnected: true };
  }
}
