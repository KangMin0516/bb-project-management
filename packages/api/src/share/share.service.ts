import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';

@Injectable()
export class ShareService {
  constructor(private prisma: PrismaService) {}

  async findIssueByKey(projectKey: string, issueNumber: number) {
    const issue = await this.prisma.issue.findFirst({
      where: {
        number: issueNumber,
        project: { key: projectKey },
      },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        projectId: true,
        assignee: { select: USER_SELECT },
        project: { select: { key: true, name: true } },
      },
    });

    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  buildOgHtml(
    issue: Awaited<ReturnType<ShareService['findIssueByKey']>>,
    baseUrl: string,
    issueKey: string,
  ): string {
    const ogTitle = `${issue.project.key}-${issue.number}: ${issue.title}`;
    const parts = [
      `Status: ${issue.status.replace(/_/g, ' ')}`,
      `Priority: ${issue.priority}`,
    ];
    if (issue.assignee) parts.push(`Assignee: ${issue.assignee.name}`);
    const ogDescription = parts.join(' · ');
    const ogUrl = `${baseUrl}/share/${issueKey}`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(ogUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(issue.project.name)}" />
  <title>${escapeHtml(ogTitle)}</title>
</head>
<body></body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
