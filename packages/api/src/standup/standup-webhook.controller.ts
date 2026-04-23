import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/index.js';
import { StandupService } from './standup.service.js';

const ISSUE_CMD = /^[/!](issue)\s+/i;

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  bot_id?: string;
  channel_type?: string;
  user: string;
  text: string;
  channel: string;
  ts: string;
  message?: { user: string; text: string; ts: string };
}

interface SlackEventBody {
  type: string;
  challenge?: string;
  event?: SlackMessageEvent;
}

interface SlackInteractionPayload {
  type: string;
  user?: { id: string };
  actions?: {
    action_id: string;
    selected_option?: { value: string };
    value?: string;
    block_id?: string;
  }[];
}

@ApiTags('Slack Webhooks')
@Controller('webhooks/slack')
export class StandupWebhookController {
  private readonly logger = new Logger(StandupWebhookController.name);

  constructor(
    private standupService: StandupService,
    private config: ConfigService,
  ) {}

  @Post('events')
  @Public()
  async handleEvents(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    // Verify Slack signature
    if (!this.verifySlackSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const body = req.body as SlackEventBody;

    // URL verification challenge
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // Respond immediately (Slack 3-second rule)
    res.status(200).send();

    // Process event asynchronously
    if (body.type === 'event_callback') {
      const event = body.event;
      if (!event) return;

      try {
        if (
          event.type === 'message' &&
          !event.subtype &&
          !event.bot_id &&
          event.channel_type === 'im'
        ) {
          // Check for /issue or !issue command
          if (ISSUE_CMD.test(event.text)) {
            const issueText = event.text.replace(ISSUE_CMD, '').trim();
            await this.standupService.handleQuickIssue(
              event.user,
              event.channel,
              issueText,
            );
            return;
          }

          // Regular DM message (user reply)
          await this.standupService.processMessage({
            user: event.user,
            text: event.text,
            channel: event.channel,
            ts: event.ts,
          });
        } else if (
          event.type === 'message' &&
          event.subtype === 'message_changed' &&
          event.channel_type === 'im' &&
          event.message
        ) {
          // Message edit
          await this.standupService.processEdit({
            channel: event.channel,
            message: event.message,
          });
        }
      } catch (err) {
        this.logger.error(
          'Failed to process Slack event',
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  @Post('interactions')
  @Public()
  async handleInteractions(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    // Verify Slack signature
    if (!this.verifySlackSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Respond immediately
    res.status(200).send();

    try {
      // Slack sends interactions as form-encoded with a "payload" JSON string field
      const rawPayload = (req.body as Record<string, unknown>)?.payload;
      const payload: SlackInteractionPayload =
        typeof rawPayload === 'string'
          ? (JSON.parse(rawPayload) as SlackInteractionPayload)
          : (rawPayload as SlackInteractionPayload);

      if (payload?.type === 'block_actions') {
        for (const action of payload.actions ?? []) {
          if (action.action_id?.startsWith('qi_') && payload.user?.id) {
            await this.standupService.handleQuickIssueAction(
              action,
              payload.user.id,
            );
          } else {
            await this.standupService.handleAction(action);
          }
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to process Slack interaction',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private verifySlackSignature(req: RawBodyRequest<Request>): boolean {
    const signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET');
    if (!signingSecret) {
      this.logger.error(
        'SLACK_SIGNING_SECRET not configured, rejecting request',
      );
      return false;
    }

    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const slackSignature = req.headers['x-slack-signature'] as string;

    if (!timestamp || !slackSignature) return false;

    // Reject requests older than 5 minutes
    const time = Math.floor(Date.now() / 1000);
    if (Math.abs(time - parseInt(timestamp, 10)) > 300) return false;

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('No raw body available for signature verification');
      return false;
    }

    const sigBasestring = `v0:${timestamp}:${rawBody.toString()}`;
    const mySignature =
      'v0=' +
      createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(mySignature),
        Buffer.from(slackSignature),
      );
    } catch {
      return false;
    }
  }
}
