import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ConnectGitHubDto,
  UpdateGitHubConfigDto,
  LinkPrDto,
} from './dto/github.dto.js';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

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
    const parts = text.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException('Corrupted encrypted token');
    }
    const [ivHex, encrypted] = parts;
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

  // ─── GitHub API Helpers ──────────────────────────────────

  private async githubFetch<T = any>(path: string, token: string): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`GitHub API error: ${res.status} ${body}`);
      throw new BadRequestException(`GitHub API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Connect ─────────────────────────────────────────────

  async connect(dto: ConnectGitHubDto, userId: string) {
    const { accessToken, projectId } = dto;

    // Validate PAT by calling /user
    const user = await this.githubFetch<{ login: string }>(
      '/user',
      accessToken,
    );
    const ownerLogin = user.login;

    if (!ownerLogin) {
      throw new BadRequestException('Invalid GitHub token');
    }

    const encryptedToken = this.encrypt(accessToken);
    const webhookSecret = randomBytes(32).toString('hex');

    const integration = await this.prisma.gitHubIntegration.upsert({
      where: { projectId },
      update: {
        accessToken: encryptedToken,
        webhookSecret,
        ownerLogin,
        installedById: userId,
      },
      create: {
        accessToken: encryptedToken,
        webhookSecret,
        ownerLogin,
        projectId,
        installedById: userId,
      },
    });

    return {
      id: integration.id,
      ownerLogin,
      webhookSecret,
    };
  }

  // ─── Status ──────────────────────────────────────────────

  async getStatus(projectId: string) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration) {
      return { connected: false };
    }

    const apiUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:3000';

    return {
      connected: true,
      id: integration.id,
      ownerLogin: integration.ownerLogin,
      webhookUrl: `${apiUrl}/api/github/webhook/${projectId}`,
      webhookSecret: integration.webhookSecret,
      onPrOpenStatus: integration.onPrOpenStatus,
      onPrMergeStatus: integration.onPrMergeStatus,
      autoLinkEnabled: integration.autoLinkEnabled,
    };
  }

  // ─── Disconnect ──────────────────────────────────────────

  async disconnect(projectId: string) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration) {
      throw new NotFoundException('GitHub integration not found');
    }

    await this.prisma.gitHubIntegration.delete({
      where: { projectId },
    });

    return { disconnected: true };
  }

  // ─── Config ──────────────────────────────────────────────

  async updateConfig(projectId: string, dto: UpdateGitHubConfigDto) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration) {
      throw new NotFoundException('GitHub integration not found');
    }

    const updated = await this.prisma.gitHubIntegration.update({
      where: { projectId },
      data: {
        ...(dto.onPrOpenStatus !== undefined && {
          onPrOpenStatus: dto.onPrOpenStatus,
        }),
        ...(dto.onPrMergeStatus !== undefined && {
          onPrMergeStatus: dto.onPrMergeStatus,
        }),
        ...(dto.autoLinkEnabled !== undefined && {
          autoLinkEnabled: dto.autoLinkEnabled,
        }),
      },
    });

    return {
      onPrOpenStatus: updated.onPrOpenStatus,
      onPrMergeStatus: updated.onPrMergeStatus,
      autoLinkEnabled: updated.autoLinkEnabled,
    };
  }

  // ─── Repos ───────────────────────────────────────────────

  async getRepos(projectId: string) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration) {
      throw new NotFoundException('GitHub integration not found');
    }

    const token = this.decrypt(integration.accessToken);
    const repos = await this.githubFetch<
      { full_name: string; html_url: string; private: boolean }[]
    >('/user/repos?per_page=100&sort=updated', token);

    return repos.map((r) => ({
      fullName: r.full_name,
      url: r.html_url,
      isPrivate: r.private,
    }));
  }

  // ─── Link PR ─────────────────────────────────────────────

  async linkPr(dto: LinkPrDto) {
    const { prUrl, issueId, projectId } = dto;

    const parsed = this.parsePrUrl(prUrl);
    if (!parsed) {
      throw new BadRequestException('Invalid GitHub PR URL');
    }

    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration) {
      throw new NotFoundException('GitHub integration not found');
    }

    const token = this.decrypt(integration.accessToken);
    const prData = await this.githubFetch<{
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
    }>(`/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`, token);

    const pr = await this.prisma.gitHubPullRequest.upsert({
      where: {
        integrationId_githubId: {
          integrationId: integration.id,
          githubId: prData.id,
        },
      },
      update: {
        title: prData.title,
        state: prData.merged ? 'merged' : prData.state,
        mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
      },
      create: {
        githubId: prData.id,
        number: prData.number,
        title: prData.title,
        url: prData.html_url,
        state: prData.merged ? 'merged' : prData.state,
        authorLogin: prData.user.login,
        authorAvatar: prData.user.avatar_url,
        repoFullName: prData.base.repo.full_name,
        baseBranch: prData.base.ref,
        headBranch: prData.head.ref,
        mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
        integrationId: integration.id,
      },
    });

    const link = await this.prisma.gitHubPrIssueLink.upsert({
      where: {
        pullRequestId_issueId: {
          pullRequestId: pr.id,
          issueId,
        },
      },
      update: {},
      create: {
        pullRequestId: pr.id,
        issueId,
      },
      include: {
        pullRequest: true,
      },
    });

    // Create activity
    await this.prisma.activity.create({
      data: {
        field: 'github_pr_linked',
        oldValue: null,
        newValue: `#${pr.number} ${pr.title}`,
        issueId,
      },
    });

    return link;
  }

  // ─── Unlink PR ───────────────────────────────────────────

  async unlinkPr(linkId: string) {
    const link = await this.prisma.gitHubPrIssueLink.findUnique({
      where: { id: linkId },
      include: { pullRequest: true },
    });

    if (!link) {
      throw new NotFoundException('PR link not found');
    }

    await this.prisma.activity.create({
      data: {
        field: 'github_pr_unlinked',
        oldValue: `#${link.pullRequest.number} ${link.pullRequest.title}`,
        newValue: null,
        issueId: link.issueId,
      },
    });

    await this.prisma.gitHubPrIssueLink.delete({
      where: { id: linkId },
    });

    return { deleted: true };
  }

  // ─── Get Integration (for webhook/sync services) ─────────

  async getIntegration(projectId: string) {
    return this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });
  }

  // ─── Upsert PR ──────────────────────────────────────────

  async upsertPr(
    integrationId: string,
    pr: {
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
    },
  ) {
    return this.prisma.gitHubPullRequest.upsert({
      where: {
        integrationId_githubId: {
          integrationId,
          githubId: pr.id,
        },
      },
      update: {
        title: pr.title,
        state: pr.merged ? 'merged' : pr.state,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        authorLogin: pr.user.login,
        authorAvatar: pr.user.avatar_url,
      },
      create: {
        githubId: pr.id,
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.merged ? 'merged' : pr.state,
        authorLogin: pr.user.login,
        authorAvatar: pr.user.avatar_url,
        repoFullName: pr.base.repo.full_name,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        integrationId,
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  parsePrUrl(
    url: string,
  ): { owner: string; repo: string; number: number } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
  }
}
