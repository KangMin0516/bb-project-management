import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import { IssueStatus } from '../../generated/prisma/enums.js';

/**
 * Cross-project (team-wide) dashboard queries. Backs the admin-only
 * `/team-dashboard/*` endpoints — getTeamDashboard, getMemberDetail,
 * getMemberIssues, getTeamIssues. Pure read; CQRS-lite per
 * refactor-plan.md §6.3.
 */
@Injectable()
export class TeamMetricsQueryService {
  private static readonly MAX_MEMBER_ISSUES = 200;
  private static readonly MAX_RECENT_ACTIVITIES = 500;

  constructor(private readonly prisma: PrismaService) {}

  private get memberIssueInclude() {
    return {
      assignee: { select: USER_SELECT },
      creator: { select: USER_SELECT },
      labels: { include: { label: true } },
      parent: { select: { id: true, number: true, title: true } },
      project: { select: { id: true, name: true, key: true } },
      _count: { select: { children: true } },
    };
  }

  async getTeamDashboard() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      activeUsers,
      focusGrouped,
      inProgressGrouped,
      todoGrouped,
      completedToday,
      overdueGrouped,
      activeIssuesGrouped,
      historicalGrouped,
      activity24h,
      unassignedCount,
      heatmapGrouped,
      todayReports,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          memberships: {
            select: {
              role: true,
              project: { select: { id: true, name: true, key: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          focusDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: { assigneeId: { not: null }, status: IssueStatus.IN_PROGRESS },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: { assigneeId: { not: null }, status: IssueStatus.TODO },
        _count: true,
      }),
      this.prisma.activity.groupBy({
        by: ['userId'],
        where: {
          field: 'status',
          newValue: IssueStatus.DONE,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _count: { _all: true },
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          dueDate: { lt: todayStart },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId', 'status'],
        where: { assigneeId: { not: null } },
        _count: true,
      }),
      this.prisma.activity.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: twentyFourHoursAgo } },
        _count: { _all: true },
      }),
      this.prisma.issue.count({
        where: {
          assigneeId: null,
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId', 'projectId'],
        where: {
          assigneeId: { not: null },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      this.prisma.standupReport.findMany({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        include: {
          answers: {
            include: { question: true },
            orderBy: { order: 'asc' },
          },
          config: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Build lookup maps
    const focusMap = new Map(
      focusGrouped.map((r) => [r.assigneeId!, r._count]),
    );
    const inProgressMap = new Map(
      inProgressGrouped.map((r) => [r.assigneeId!, r._count]),
    );
    const todoMap = new Map(todoGrouped.map((r) => [r.assigneeId!, r._count]));
    const completedMap = new Map(
      completedToday.map((r) => [r.userId, r._count._all]),
    );
    const overdueMap = new Map(
      overdueGrouped.map((r) => [r.assigneeId!, r._count]),
    );
    const activeMap = new Map(
      activeIssuesGrouped.map((r) => [r.assigneeId!, r._count]),
    );
    const activityMap = new Map(
      activity24h.map((r) => [r.userId, r._count._all]),
    );

    const historicalTotalMap = new Map<string, number>();
    const historicalDoneMap = new Map<string, number>();
    for (const row of historicalGrouped) {
      if (!row.assigneeId) continue;
      historicalTotalMap.set(
        row.assigneeId,
        (historicalTotalMap.get(row.assigneeId) ?? 0) + row._count,
      );
      if (row.status === IssueStatus.DONE) {
        historicalDoneMap.set(
          row.assigneeId,
          (historicalDoneMap.get(row.assigneeId) ?? 0) + row._count,
        );
      }
    }

    const heatmapByUser = new Map<string, Map<string, number>>();
    const projectSet = new Map<
      string,
      { id: string; name: string; key: string }
    >();
    for (const row of heatmapGrouped) {
      if (!row.assigneeId) continue;
      if (!heatmapByUser.has(row.assigneeId))
        heatmapByUser.set(row.assigneeId, new Map());
      heatmapByUser.get(row.assigneeId)!.set(row.projectId, row._count);
    }

    for (const user of activeUsers) {
      for (const m of user.memberships) {
        if (!projectSet.has(m.project.id)) {
          projectSet.set(m.project.id, m.project);
        }
      }
    }
    const allProjects = [...projectSet.values()].sort((a, b) =>
      a.key.localeCompare(b.key),
    );

    const members = activeUsers.map((u) => ({
      user: { id: u.id, email: u.email, name: u.name, avatar: u.avatar },
      projects: u.memberships.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        key: m.project.key,
        role: m.role,
      })),
      today: {
        focusCount: focusMap.get(u.id) ?? 0,
        todoCount: todoMap.get(u.id) ?? 0,
        inProgressCount: inProgressMap.get(u.id) ?? 0,
        completedCount: completedMap.get(u.id) ?? 0,
        overdueCount: overdueMap.get(u.id) ?? 0,
      },
      overall: {
        totalActive: activeMap.get(u.id) ?? 0,
        totalHistorical: historicalTotalMap.get(u.id) ?? 0,
        doneHistorical: historicalDoneMap.get(u.id) ?? 0,
      },
      recentActivityCount: activityMap.get(u.id) ?? 0,
    }));

    const totalCompletedToday = completedToday.reduce(
      (sum, r) => sum + r._count._all,
      0,
    );
    const totalOverdue = overdueGrouped.reduce((sum, r) => sum + r._count, 0);
    const standupAnswered = todayReports.filter(
      (r) => r.status === 'ANSWERED',
    ).length;
    const standupUnanswered = todayReports.filter(
      (r) => r.status === 'UNANSWERED',
    ).length;

    const slackUserIds = todayReports.map((r) => r.slackUserId);
    const mappedUsers = await this.prisma.user.findMany({
      where: { slackUserId: { in: slackUserIds } },
      select: { id: true, name: true, avatar: true, slackUserId: true },
    });
    const slackUserMap = new Map(mappedUsers.map((u) => [u.slackUserId!, u]));

    const standup = {
      total: todayReports.length,
      answered: standupAnswered,
      unanswered: standupUnanswered,
      reports: todayReports.map((r) => {
        const mapped = slackUserMap.get(r.slackUserId);
        return {
          slackUsername: r.username ?? r.slackUserId,
          systemUser: mapped
            ? { id: mapped.id, name: mapped.name, avatar: mapped.avatar }
            : null,
          status: r.status,
          configName: r.config.name,
          completedAt: r.updatedAt?.toISOString() ?? null,
          answers: r.answers
            .filter((a) => a.answer)
            .map((a) => ({ question: a.question.text, answer: a.answer! })),
        };
      }),
    };

    return {
      summary: {
        activeMembers: activeUsers.length,
        completedToday: totalCompletedToday,
        overdueTotal: totalOverdue,
        unassignedTotal: unassignedCount,
      },
      members,
      standup,
      heatmap: {
        projects: allProjects,
        rows: activeUsers.map((u) => ({
          userId: u.id,
          userName: u.name,
          cells: allProjects.map((p) => ({
            projectId: p.id,
            activeCount: heatmapByUser.get(u.id)?.get(p.id) ?? 0,
          })),
        })),
      },
    };
  }

  async getMemberDetail(userId: string) {
    const { todayStart, todayEnd, sevenDaysAgo } = this.getDateRanges();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackUserId: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [issues, recentActivities, completedToday, standupReports] =
      await Promise.all([
        this.prisma.issue.findMany({
          where: {
            assigneeId: userId,
            status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
          },
          include: this.memberIssueInclude,
          orderBy: [
            { dueDate: { sort: 'asc', nulls: 'last' } },
            { priority: 'asc' },
            { createdAt: 'desc' },
          ],
          take: TeamMetricsQueryService.MAX_MEMBER_ISSUES,
        }),
        this.prisma.activity.findMany({
          where: { userId, createdAt: { gte: sevenDaysAgo } },
          include: {
            issue: {
              select: {
                id: true,
                number: true,
                title: true,
                project: { select: { id: true, name: true, key: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: TeamMetricsQueryService.MAX_RECENT_ACTIVITIES,
        }),
        this.prisma.activity.count({
          where: {
            userId,
            field: 'status',
            newValue: IssueStatus.DONE,
            createdAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        user.slackUserId
          ? this.prisma.standupReport.findMany({
              where: {
                slackUserId: user.slackUserId,
                createdAt: { gte: todayStart, lte: todayEnd },
              },
              include: {
                answers: {
                  include: { question: true },
                  orderBy: { order: 'asc' },
                },
                config: { select: { name: true } },
              },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
      ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      issues,
      todayStats: {
        ...this.computeTodayStats(issues, todayStart, todayEnd),
        completedCount: completedToday,
      },
      standup: this.formatStandupReports(standupReports),
      activityLog: await this.groupActivitiesByDate(recentActivities),
    };
  }

  async getMemberIssues(userId: string) {
    const [user, issues] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatar: true },
      }),
      this.prisma.issue.findMany({
        where: {
          assigneeId: userId,
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        include: this.memberIssueInclude,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        take: TeamMetricsQueryService.MAX_MEMBER_ISSUES,
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    return { user, issues };
  }

  async getTeamIssues(filter: string) {
    const { todayStart, todayEnd } = this.getDateRanges();
    const baseWhere: Record<string, unknown> = {};

    switch (filter) {
      case 'overdue':
        baseWhere.dueDate = { lt: todayStart };
        baseWhere.status = { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] };
        break;
      case 'unassigned':
        baseWhere.assigneeId = null;
        baseWhere.status = { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] };
        break;
      case 'completed_today':
        baseWhere.status = IssueStatus.DONE;
        baseWhere.updatedAt = { gte: todayStart, lte: todayEnd };
        break;
      case 'in_progress':
        baseWhere.status = IssueStatus.IN_PROGRESS;
        break;
      case 'todo':
        baseWhere.status = IssueStatus.TODO;
        break;
      default:
        baseWhere.status = { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] };
    }

    const issues = await this.prisma.issue.findMany({
      where: baseWhere,
      include: this.memberIssueInclude,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 500,
    });

    return { filter, issues };
  }

  // ─── Helpers (preserved from legacy) ─────────────────────────

  private getDateRanges() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    return { todayStart, todayEnd, sevenDaysAgo };
  }

  private computeTodayStats(
    issues: {
      focusDate: Date | null;
      status: IssueStatus;
      dueDate: Date | null;
    }[],
    todayStart: Date,
    todayEnd: Date,
  ) {
    return {
      focusCount: issues.filter(
        (i) =>
          i.focusDate && i.focusDate >= todayStart && i.focusDate <= todayEnd,
      ).length,
      todoCount: issues.filter((i) => i.status === IssueStatus.TODO).length,
      inProgressCount: issues.filter(
        (i) => i.status === IssueStatus.IN_PROGRESS,
      ).length,
      overdueCount: issues.filter((i) => i.dueDate && i.dueDate < todayStart)
        .length,
    };
  }

  private formatStandupReports(
    reports: {
      status: string;
      config: { name: string };
      updatedAt: Date | null;
      answers: { answer: string | null; question: { text: string } }[];
    }[],
  ) {
    return reports.map((r) => ({
      status: r.status,
      configName: r.config.name,
      completedAt: r.updatedAt?.toISOString() ?? null,
      answers: r.answers
        .filter((a) => a.answer)
        .map((a) => ({ question: a.question.text, answer: a.answer! })),
    }));
  }

  private async groupActivitiesByDate(
    activities: {
      createdAt: Date;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      issue: {
        id: string;
        number: number;
        title: string;
        project: { key: string };
      };
    }[],
  ) {
    const userIds = new Set<string>();
    for (const a of activities) {
      if (
        (a.field === 'assigneeId' || a.field === 'reviewerAssigneeId') &&
        (a.oldValue || a.newValue)
      ) {
        if (a.oldValue) userIds.add(a.oldValue);
        if (a.newValue) userIds.add(a.newValue);
      }
    }

    const userNameMap = new Map<string, string>();
    if (userIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true },
      });
      for (const u of users) userNameMap.set(u.id, u.name);
    }

    const resolveValue = (field: string, value: string | null) => {
      if (!value) return null;
      if (field === 'assigneeId' || field === 'reviewerAssigneeId') {
        return userNameMap.get(value) ?? value;
      }
      return value;
    };

    const byDate = new Map<
      string,
      {
        issueId: string;
        issueNumber: number;
        issueTitle: string;
        projectKey: string;
        field: string;
        oldValue: string | null;
        newValue: string | null;
        createdAt: string;
      }[]
    >();
    for (const a of activities) {
      const dateKey = a.createdAt.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push({
        issueId: a.issue.id,
        issueNumber: a.issue.number,
        issueTitle: a.issue.title,
        projectKey: a.issue.project.key,
        field: a.field,
        oldValue: resolveValue(a.field, a.oldValue),
        newValue: resolveValue(a.field, a.newValue),
        createdAt: a.createdAt.toISOString(),
      });
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, entries]) => ({ date, entries }));
  }
}
