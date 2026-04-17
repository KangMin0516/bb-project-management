import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { IssueStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class GitHubSyncService {
  private readonly logger = new Logger(GitHubSyncService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Issue Key Parsing ───────────────────────────────────

  parseIssueKeys(text: string): { key: string; number: number }[] {
    const regex = /\b([A-Z][A-Z0-9_]{1,9})-(\d+)/g;
    const results: { key: string; number: number }[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1];
      const num = parseInt(match[2], 10);
      const id = `${key}-${num}`;
      if (!seen.has(id)) {
        seen.add(id);
        results.push({ key, number: num });
      }
    }

    return results;
  }

  // ─── Auto Link Issues ───────────────────────────────────

  async autoLinkIssues(projectId: string, prId: string, text: string) {
    const parsed = this.parseIssueKeys(text);
    if (parsed.length === 0) return;

    // Get project key
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { key: true },
    });

    if (!project) return;

    // Filter to only keys matching this project
    const matching = parsed.filter((p) => p.key === project.key);
    if (matching.length === 0) return;

    for (const { number } of matching) {
      const issue = await this.prisma.issue.findUnique({
        where: { projectId_number: { projectId, number } },
        select: { id: true },
      });

      if (!issue) continue;

      // Upsert link
      try {
        await this.prisma.gitHubPrIssueLink.upsert({
          where: {
            pullRequestId_issueId: {
              pullRequestId: prId,
              issueId: issue.id,
            },
          },
          update: {},
          create: {
            pullRequestId: prId,
            issueId: issue.id,
          },
        });

        // Create activity
        const pr = await this.prisma.gitHubPullRequest.findUnique({
          where: { id: prId },
          select: { number: true, title: true },
        });

        if (pr) {
          await this.prisma.activity.create({
            data: {
              field: 'github_pr_auto_linked',
              oldValue: null,
              newValue: `#${pr.number} ${pr.title}`,
              issueId: issue.id,
            },
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-link PR to issue ${number}`, err);
      }
    }
  }

  // ─── Status Sync ─────────────────────────────────────────

  async syncStatusOnPrOpen(projectId: string, prId: string) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration?.onPrOpenStatus) return;

    await this.transitionLinkedIssues(
      prId,
      projectId,
      integration.onPrOpenStatus as IssueStatus,
    );
  }

  async syncStatusOnPrMerge(projectId: string, prId: string) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { projectId },
    });

    if (!integration?.onPrMergeStatus) return;

    await this.transitionLinkedIssues(
      prId,
      projectId,
      integration.onPrMergeStatus as IssueStatus,
    );
  }

  private async transitionLinkedIssues(
    prId: string,
    projectId: string,
    targetStatus: IssueStatus,
  ) {
    const links = await this.prisma.gitHubPrIssueLink.findMany({
      where: { pullRequestId: prId },
      include: {
        issue: { select: { id: true, status: true, projectId: true } },
      },
    });

    for (const link of links) {
      if (link.issue.projectId !== projectId) continue;
      if (link.issue.status === targetStatus) continue;

      try {
        await this.prisma.issue.update({
          where: { id: link.issue.id },
          data: {
            status: targetStatus,
            activities: {
              create: {
                field: 'status',
                oldValue: link.issue.status,
                newValue: targetStatus,
              },
            },
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to transition issue ${link.issue.id}`, err);
      }
    }
  }
}
