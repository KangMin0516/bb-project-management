import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { EncryptionService } from '../../common/encryption.service.js';
import type {
  MessageBlock,
  MessagingPort,
  SendResult,
  WorkspaceStatus,
} from '../../common/ports/messaging.port.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toSlackBlocks } from './slack-block.mapper.js';

const MAX_RETRIES = 3;

/**
 * Slack-backed implementation of MessagingPort.
 *
 * Behaviour preserved from legacy SlackService (see
 * behavior-preservation-checklist §6.1):
 *  - sendDirectMessage uses the most-recently-installed integration
 *    and never throws. Failures return `{ delivered: false, reason }`.
 *  - sendChannelMessage targets a specific integration and throws
 *    after retry budget exhaustion.
 *  - Both retry on `ratelimited` with the server-supplied `retryAfter`
 *    (falls back to exponential backoff).
 *  - Bot tokens are decrypted via the shared EncryptionService — never
 *    leaked outside the adapter.
 *
 * Vendor-native features (users.info lookups, interactive payloads,
 * OAuth flow) stay in SlackService and SlackController. The adapter
 * deliberately exposes only the cross-vendor messaging shape.
 */
@Injectable()
export class SlackAdapter implements MessagingPort {
  private readonly logger = new Logger(SlackAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getWorkspaceStatus(): Promise<WorkspaceStatus> {
    const integration = await this.prisma.slackIntegration.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!integration) return { connected: false };
    return {
      connected: true,
      integrationId: integration.id,
      teamName: integration.teamName,
    };
  }

  async sendDirectMessage(
    recipientUserId: string,
    fallbackText: string,
    blocks: MessageBlock[],
  ): Promise<SendResult> {
    const integration = await this.prisma.slackIntegration.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!integration) {
      this.logger.debug(
        `No Slack integration installed; skipping DM to ${recipientUserId}`,
      );
      return { delivered: false, reason: 'no_integration' };
    }

    const client = this.clientFor(integration.botToken);

    let dmChannelId: string | undefined;
    try {
      const dm = await client.conversations.open({ users: recipientUserId });
      dmChannelId = dm.channel?.id;
    } catch (err) {
      this.logger.warn(
        `Failed to open DM with ${recipientUserId}`,
        err instanceof Error ? err.message : String(err),
      );
      return { delivered: false, reason: 'unknown_error' };
    }

    if (!dmChannelId) {
      this.logger.warn(`No DM channel id for Slack user ${recipientUserId}`);
      return { delivered: false, reason: 'no_recipient' };
    }

    const slackBlocks = toSlackBlocks(blocks);
    return this.postWithRetry(client, dmChannelId, fallbackText, slackBlocks, {
      throwOnFinalFailure: false,
      recipientLabel: recipientUserId,
    });
  }

  async sendChannelMessage(
    integrationId: string,
    channelId: string,
    fallbackText: string,
    blocks: MessageBlock[],
  ): Promise<void> {
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) {
      throw new NotFoundException('Slack integration not found');
    }

    const client = this.clientFor(integration.botToken);
    const slackBlocks = toSlackBlocks(blocks);
    await this.postWithRetry(client, channelId, fallbackText, slackBlocks, {
      throwOnFinalFailure: true,
      recipientLabel: channelId,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────

  /**
   * Token → WebClient. `protected` (not private) so unit tests can
   * subclass and inject a fake client without pulling in
   * `jest.unstable_mockModule` for the entire Slack SDK.
   */
  protected clientFor(encryptedToken: string): WebClient {
    return new WebClient(this.encryption.decrypt(encryptedToken));
  }

  /**
   * Posts with bounded retry on `ratelimited`. When `throwOnFinalFailure`
   * is false (DM mode), returns a SendResult with the reason; when true
   * (channel mode), rethrows the last error.
   */
  private async postWithRetry(
    client: WebClient,
    channel: string,
    fallbackText: string,
    blocks: unknown[],
    opts: { throwOnFinalFailure: boolean; recipientLabel: string },
  ): Promise<SendResult> {
    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        await client.chat.postMessage({
          channel,
          text: fallbackText,
          blocks: blocks as never[],
        });
        return { delivered: true };
      } catch (err: unknown) {
        const error = err as {
          data?: { error?: string };
          retryAfter?: number;
        };
        const isRateLimit = error.data?.error === 'ratelimited';
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delayMs = (error.retryAfter ?? Math.pow(2, attempt)) * 1000;
          this.logger.warn(
            `Slack rate limited (attempt ${attempt + 1}); retrying in ${delayMs}ms`,
          );
          await sleep(delayMs);
          attempt++;
          continue;
        }
        const reason: SendResult['reason'] = isRateLimit
          ? 'rate_limited'
          : 'unknown_error';
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Slack post failed for ${opts.recipientLabel}: ${msg}`,
        );
        if (opts.throwOnFinalFailure) throw err;
        return { delivered: false, reason };
      }
    }
    // Loop exits only via return / throw above. This is unreachable
    // but TypeScript can't prove it.
    return { delivered: false, reason: 'unknown_error' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
