import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { WebClient } from '@slack/web-api';
import { PrismaService } from '../prisma/prisma.service.js';

interface ChannelCache {
  channels: { id: string; name: string }[];
  expiresAt: number;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly channelCache = new Map<string, ChannelCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ─── Encryption ──────────────────────────────────────────

  encrypt(text: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getEncryptionKey(): Buffer {
    const keyHex = this.config.get<string>('ENCRYPTION_KEY');
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    return Buffer.from(keyHex, 'hex');
  }

  // ─── OAuth ───────────────────────────────────────────────

  getInstallUrl(userId: string): string {
    const clientId = this.config.get<string>('SLACK_CLIENT_ID');
    const redirectUri = this.config.get<string>('SLACK_REDIRECT_URI');

    // Encode userId + expiry into state (encrypted token)
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    const state = this.encrypt(JSON.stringify({ userId, exp: expiry }));
    const encodedState = encodeURIComponent(state);

    const scopes = 'chat:write,channels:read,groups:read';
    return (
      `https://slack.com/oauth/v2/authorize` +
      `?client_id=${clientId}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri!)}` +
      `&state=${encodedState}`
    );
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ teamName: string }> {
    // Verify state
    let statePayload: { userId: string; exp: number };
    try {
      statePayload = JSON.parse(this.decrypt(state));
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    if (Date.now() > statePayload.exp) {
      throw new UnauthorizedException('OAuth state expired');
    }

    // Exchange code for token
    const clientId = this.config.get<string>('SLACK_CLIENT_ID');
    const clientSecret = this.config.get<string>('SLACK_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('SLACK_REDIRECT_URI');

    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri,
    });

    if (!result.ok || !result.access_token) {
      throw new UnauthorizedException('Slack OAuth failed');
    }

    const teamId = result.team?.id;
    const teamName = result.team?.name ?? 'Unknown';
    const botToken = result.access_token;

    if (!teamId) {
      throw new UnauthorizedException('Could not determine Slack team');
    }

    // Encrypt and save
    const encryptedToken = this.encrypt(botToken);

    await this.prisma.slackIntegration.upsert({
      where: { teamId },
      update: {
        teamName,
        botToken: encryptedToken,
        installedById: statePayload.userId,
      },
      create: {
        teamId,
        teamName,
        botToken: encryptedToken,
        installedById: statePayload.userId,
      },
    });

    return { teamName };
  }

  // ─── Channel List ────────────────────────────────────────

  async getChannels(
    integrationId: string,
  ): Promise<{ id: string; name: string }[]> {
    // Check cache
    const cached = this.channelCache.get(integrationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.channels;
    }

    const integration = await this.prisma.slackIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Slack integration not found');
    }

    const token = this.decrypt(integration.botToken);
    const client = new WebClient(token);

    const channels: { id: string; name: string }[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
        cursor,
      });

      for (const ch of result.channels ?? []) {
        if (ch.id && ch.name) {
          channels.push({ id: ch.id, name: ch.name });
        }
      }

      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);

    // Cache
    this.channelCache.set(integrationId, {
      channels,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return channels;
  }

  // ─── Send Message ────────────────────────────────────────

  async sendMessage(
    integrationId: string,
    channelId: string,
    blocks: unknown[],
    text: string,
  ): Promise<void> {
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Slack integration not found');
    }

    const token = this.decrypt(integration.botToken);
    const client = new WebClient(token);

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        await client.chat.postMessage({
          channel: channelId,
          blocks: blocks as never[],
          text,
        });
        return;
      } catch (err: unknown) {
        const error = err as { data?: { error?: string }; retryAfter?: number };
        if (
          error.data?.error === 'ratelimited' &&
          retries < maxRetries
        ) {
          const delay = (error.retryAfter ?? Math.pow(2, retries)) * 1000;
          this.logger.warn(
            `Slack rate limited, retrying in ${delay}ms (attempt ${retries + 1})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries++;
        } else {
          throw err;
        }
      }
    }
  }

  // ─── Disconnect ──────────────────────────────────────────

  async disconnect(integrationId: string): Promise<void> {
    if (!integrationId) {
      throw new NotFoundException('No Slack integration to disconnect');
    }

    // Verify integration exists before deleting
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Slack integration not found');
    }

    // Delete related configs first
    await this.prisma.dailyReportConfig.deleteMany({
      where: { slackIntegrationId: integrationId },
    });

    await this.prisma.slackIntegration.delete({
      where: { id: integrationId },
    });

    // Clear cache
    this.channelCache.delete(integrationId);
  }

  // ─── Status ──────────────────────────────────────────────

  async getStatus(): Promise<{
    connected: boolean;
    integrationId?: string;
    teamName?: string;
  }> {
    const integration = await this.prisma.slackIntegration.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      integrationId: integration.id,
      teamName: integration.teamName,
    };
  }
}
