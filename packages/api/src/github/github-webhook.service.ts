import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { GitHubService } from './github.service.js';
import { GitHubSyncService } from './github-sync.service.js';

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private githubService: GitHubService,
    private githubSyncService: GitHubSyncService,
  ) {}

  async handleWebhook(
    projectId: string,
    event: string,
    signature: string,
    rawBody: Buffer,
  ) {
    const integration = await this.githubService.getIntegration(projectId);
    if (!integration) {
      throw new BadRequestException('GitHub integration not found');
    }

    // Verify signature
    this.verifySignature(integration.webhookSecret, signature, rawBody);

    const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;

    switch (event) {
      case 'pull_request':
        await this.handlePullRequest(integration.id, projectId, payload);
        break;
      default:
        this.logger.debug(`Ignoring GitHub event: ${event}`);
    }

    return { ok: true };
  }

  private verifySignature(secret: string, signature: string, body: Buffer) {
    if (!signature) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256');
    }

    const expected =
      'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async handlePullRequest(
    integrationId: string,
    projectId: string,
    payload: Record<string, unknown>,
  ) {
    const action = payload.action as string;
    const prData = payload.pull_request as {
      id: number;
      number: number;
      title: string;
      html_url: string;
      state: string;
      merged: boolean;
      merged_at: string | null;
      user: { login: string; avatar_url: string };
      base: { ref: string; repo: { full_name: string } };
      head: { ref: string };
    };

    if (!prData) return;

    // Upsert PR record
    const pr = await this.githubService.upsertPr(integrationId, prData);

    // Auto-link: parse issue keys from title, body, head branch
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { id: integrationId },
    });

    if (integration?.autoLinkEnabled) {
      const title = prData.title ?? '';
      const body =
        ((payload.pull_request as Record<string, unknown>)?.body as string) ??
        '';
      const headBranch = prData.head?.ref ?? '';

      const textToSearch = `${title} ${body} ${headBranch}`;
      await this.githubSyncService.autoLinkIssues(
        projectId,
        pr.id,
        textToSearch,
      );
    }

    // Status sync on open/merge
    if (action === 'opened' || action === 'reopened') {
      await this.githubSyncService.syncStatusOnPrOpen(projectId, pr.id);
    } else if (action === 'closed' && prData.merged) {
      await this.githubSyncService.syncStatusOnPrMerge(projectId, pr.id);
    }
  }
}
