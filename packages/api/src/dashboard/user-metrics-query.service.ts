import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import { IssueStatus } from '../../generated/prisma/enums.js';

/**
 * Per-user cross-project "global dashboard" query. Backs the
 * personal landing page (`/global-dashboard`) that surfaces every
 * project the user is a member of + focus/overdue rollup.
 *
 * Read-only; CQRS-lite per refactor-plan.md §6.3.
 */
@Injectable()
export class UserMetricsQueryService {
  private static readonly MAX_MY_ISSUES = 100;

  constructor(private readonly prisma: PrismaService) {}

  async getMyGlobalDashboard(userId: string) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId, project: { archivedAt: null } },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
    });
    const projectIds = memberships.map((m) => m.project.id);

    if (projectIds.length === 0) {
      return { projects: [], focusIssues: [], myIssues: [], overdueIssues: [] };
    }

    const issueInclude = {
      assignee: { select: USER_SELECT },
      creator: { select: USER_SELECT },
      labels: { include: { label: true } },
      parent: { select: { id: true, number: true, title: true } },
      project: { select: { id: true, name: true, key: true } },
      _count: { select: { children: true } },
    };

    const [
      allMyIssues,
      overdueIssues,
      totalByProject,
      statusByProject,
      myByProject,
    ] = await Promise.all([
      this.prisma.issue.findMany({
        where: {
          projectId: { in: projectIds },
          assigneeId: userId,
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        include: issueInclude,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        take: UserMetricsQueryService.MAX_MY_ISSUES,
      }),
      this.prisma.issue.findMany({
        where: {
          projectId: { in: projectIds },
          assigneeId: userId,
          dueDate: { lt: todayStart },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { id: true, name: true, avatar: true } },
          project: { select: { id: true, name: true, key: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      this.prisma.issue.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds } },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, status: IssueStatus.DONE },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          assigneeId: userId,
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
    ]);

    const totalMap = new Map(
      totalByProject.map((r) => [r.projectId, r._count]),
    );
    const doneMap = new Map(
      statusByProject.map((r) => [r.projectId, r._count]),
    );
    const myMap = new Map(myByProject.map((r) => [r.projectId, r._count]));
    const projectStats = memberships.map((m) => ({
      ...m.project,
      totalIssues: totalMap.get(m.project.id) ?? 0,
      doneIssues: doneMap.get(m.project.id) ?? 0,
      myIssueCount: myMap.get(m.project.id) ?? 0,
    }));

    const focusIssues = allMyIssues.filter(
      (i) =>
        i.focusDate && i.focusDate >= todayStart && i.focusDate <= todayEnd,
    );
    const myIssues = allMyIssues.filter(
      (i) => !i.focusDate || i.focusDate < todayStart || i.focusDate > todayEnd,
    );

    return {
      projects: projectStats,
      focusIssues,
      myIssues,
      overdueIssues,
    };
  }
}
