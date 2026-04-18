import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import { IssueStatus } from '../../generated/prisma/enums.js';

type AssigneeInfo = { id: string; name: string; avatar: string | null };

@Injectable()
export class DashboardService {
  private static readonly MAX_MY_ISSUES = 100;

  constructor(private prisma: PrismaService) {}

  async getProjectStats(projectId: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    // UTC date range — Prisma @db.Date columns are returned as UTC midnight
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [
      totalIssues,
      byStatus,
      byPriority,
      byType,
      byAssignee,
      recentActivities,
      memberCount,
      completionByAssigneeRaw,
    ] = await Promise.all([
      this.prisma.issue.count({ where: { projectId } }),
      this.prisma.issue.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['priority'],
        where: { projectId },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['type'],
        where: { projectId },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: { projectId, assigneeId: { not: null } },
        _count: true,
      }),
      this.prisma.activity.findMany({
        where: { issue: { projectId } },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          issue: { select: { id: true, number: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.projectMember.count({ where: { projectId } }),
      this.prisma.issue.groupBy({
        by: ['assigneeId', 'status'],
        where: { projectId, assigneeId: { not: null } },
        _count: true,
      }),
    ]);

    const [burndownData, overdueIssues] = await Promise.all([
      this.getBurndownData(projectId),
      this.getOverdueIssues(projectId),
    ]);

    const assigneeMap = await this.resolveAssignees(
      byAssignee,
      completionByAssigneeRaw,
    );
    const completionByAssignee = this.buildCompletionStats(
      completionByAssigneeRaw,
      assigneeMap,
    );
    const workloadByAssignee = this.buildWorkloadByAssignee(
      completionByAssigneeRaw,
      assigneeMap,
    );
    const { focus: myFocusIssues, others: myOtherIssues } =
      await this.getMyIssuesWithFocus(projectId, userId, todayStart, todayEnd);

    return {
      project: { id: project.id, name: project.name, key: project.key },
      totalIssues,
      memberCount,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count,
      })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byAssignee: byAssignee.map((a) => ({
        assignee: assigneeMap.get(a.assigneeId!) ?? null,
        count: a._count,
      })),
      completionByAssignee,
      workloadByAssignee,
      burndownData,
      overdueIssues,
      overdueCount: overdueIssues.length,
      recentActivities,
      myIssues: myOtherIssues,
      myFocusIssues,
    };
  }

  private async resolveAssignees(
    byAssignee: { assigneeId: string | null }[],
    completionRaw: { assigneeId: string | null }[],
  ): Promise<Map<string, AssigneeInfo>> {
    const idSet = new Set<string>();
    for (const a of byAssignee) {
      if (a.assigneeId) idSet.add(a.assigneeId);
    }
    for (const r of completionRaw) {
      if (r.assigneeId) idSet.add(r.assigneeId);
    }
    const ids = [...idSet];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, avatar: true },
        })
      : [];
    return new Map(users.map((u) => [u.id, u]));
  }

  private buildCompletionStats(
    raw: { assigneeId: string | null; status: IssueStatus; _count: number }[],
    assigneeMap: Map<string, AssigneeInfo>,
  ) {
    const map = new Map<string, { total: number; done: number }>();
    for (const row of raw) {
      if (!row.assigneeId) continue;
      const entry = map.get(row.assigneeId) || { total: 0, done: 0 };
      entry.total += row._count;
      if (row.status === IssueStatus.DONE) entry.done += row._count;
      map.set(row.assigneeId, entry);
    }
    return [...map.entries()]
      .map(([id, stats]) => ({
        user: assigneeMap.get(id) ?? { id, name: 'Unknown', avatar: null },
        total: stats.total,
        done: stats.done,
      }))
      .sort((a, b) => {
        const rateA = a.total ? a.done / a.total : 0;
        const rateB = b.total ? b.done / b.total : 0;
        return rateB - rateA;
      });
  }

  private async getMyIssuesWithFocus(
    projectId: string,
    userId: string | undefined,
    todayStart: Date,
    todayEnd: Date,
  ) {
    if (!userId) return { focus: [] as never[], others: [] as never[] };

    const issueInclude = {
      assignee: { select: USER_SELECT },
      creator: { select: USER_SELECT },
      labels: { include: { label: true } },
      parent: { select: { id: true, number: true, title: true } },
      _count: { select: { children: true } },
    };

    const myIssues = await this.prisma.issue.findMany({
      where: {
        projectId,
        assigneeId: userId,
        status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
      },
      include: issueInclude,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      take: DashboardService.MAX_MY_ISSUES,
    });

    // Split by focusDate = today (UTC comparison for @db.Date columns)
    const focus = myIssues.filter(
      (i) =>
        i.focusDate && i.focusDate >= todayStart && i.focusDate <= todayEnd,
    );
    const others = myIssues.filter(
      (i) => !i.focusDate || i.focusDate < todayStart || i.focusDate > todayEnd,
    );

    return { focus, others };
  }

  private buildWorkloadByAssignee(
    raw: { assigneeId: string | null; status: IssueStatus; _count: number }[],
    assigneeMap: Map<string, AssigneeInfo>,
  ) {
    const map = new Map<
      string,
      { statuses: Record<string, number>; total: number }
    >();
    for (const row of raw) {
      if (!row.assigneeId) continue;
      const entry = map.get(row.assigneeId) || { statuses: {}, total: 0 };
      entry.statuses[row.status] =
        (entry.statuses[row.status] || 0) + row._count;
      entry.total += row._count;
      map.set(row.assigneeId, entry);
    }
    return [...map.entries()]
      .map(([id, data]) => ({
        assigneeId: id,
        name: assigneeMap.get(id)?.name ?? 'Unknown',
        avatar: assigneeMap.get(id)?.avatar ?? null,
        statuses: data.statuses,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }

  private async getBurndownData(projectId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    // Get all issues in the project with creation info and current status
    const issues = await this.prisma.issue.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get ALL status-change activities within the window (not just DONE)
    // to correctly handle reopened issues
    const statusActivities = await this.prisma.activity.findMany({
      where: {
        issue: { projectId },
        field: 'status',
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        issueId: true,
        newValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build a map: issueId -> latest closed date (only if currently closed)
    // Use current status to exclude reopened issues
    const closedDateMap = new Map<string, Date>();
    const closedStatuses = new Set<IssueStatus>([
      IssueStatus.DONE,
      IssueStatus.CANCELED,
    ]);

    // Track latest status transition per issue
    const latestStatusByIssue = new Map<
      string,
      { status: string; date: Date }
    >();
    for (const act of statusActivities) {
      latestStatusByIssue.set(act.issueId, {
        status: act.newValue!,
        date: act.createdAt,
      });
      if (closedStatuses.has(act.newValue as IssueStatus)) {
        closedDateMap.set(act.issueId, act.createdAt);
      } else {
        // Reopened — remove closed date
        closedDateMap.delete(act.issueId);
      }
    }

    // For issues currently DONE/CANCELED that have no activity record in window,
    // use their updatedAt as approximation
    for (const issue of issues) {
      if (closedStatuses.has(issue.status) && !closedDateMap.has(issue.id)) {
        closedDateMap.set(issue.id, issue.updatedAt);
      }
    }

    // Pre-sort issues by createdAt for efficient sweep
    const sortedIssues = [...issues].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    // Collect close/reopen events sorted by date for sweep algorithm
    // Track per-issue closed state to only count real reopens
    type Event = { date: Date; delta: number };
    const events: Event[] = [];
    const issueClosedState = new Map<string, boolean>();
    for (const act of statusActivities) {
      const wasClosed = issueClosedState.get(act.issueId) ?? false;
      if (closedStatuses.has(act.newValue as IssueStatus)) {
        if (!wasClosed) {
          events.push({ date: act.createdAt, delta: -1 });
        }
        issueClosedState.set(act.issueId, true);
      } else {
        if (wasClosed) {
          // Only count as reopen if previously closed
          events.push({ date: act.createdAt, delta: +1 });
        }
        issueClosedState.set(act.issueId, false);
      }
    }

    // Count initial open issues before the window
    let baseOpen = 0;
    for (const issue of issues) {
      if (issue.createdAt <= thirtyDaysAgo) {
        const closedDate = closedDateMap.get(issue.id);
        // Check if it was closed before the window started
        const closedBefore = closedDate && closedDate < thirtyDaysAgo;
        // Also check updatedAt for issues closed before window with no activity
        if (!closedBefore) baseOpen++;
      }
    }

    // Simpler approach: for each day, count directly but use sorted arrays
    // to avoid O(30*N) — use sorted creation dates + event-based deltas
    const result: { date: string; openCount: number }[] = [];
    let issueIdx = 0;
    let openCount = baseOpen;

    // Sort events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    let eventIdx = 0;

    for (let d = 0; d < 30; d++) {
      const day = new Date(thirtyDaysAgo);
      day.setUTCDate(day.getUTCDate() + d);
      const dayEnd = new Date(day);
      dayEnd.setUTCHours(23, 59, 59, 999);

      // Add newly created issues up to dayEnd
      while (
        issueIdx < sortedIssues.length &&
        sortedIssues[issueIdx].createdAt <= dayEnd
      ) {
        if (sortedIssues[issueIdx].createdAt > thirtyDaysAgo) {
          openCount++;
        }
        issueIdx++;
      }

      // Apply close/reopen events up to dayEnd
      while (eventIdx < events.length && events[eventIdx].date <= dayEnd) {
        openCount += events[eventIdx].delta;
        eventIdx++;
      }

      result.push({
        date: day.toISOString().slice(0, 10),
        openCount: Math.max(0, openCount),
      });
    }

    return result;
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
      // 1. Active users + memberships
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
      // 2. focusDate = today
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          focusDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      // 3. status = IN_PROGRESS
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          status: IssueStatus.IN_PROGRESS,
        },
        _count: true,
      }),
      // 3.5. status = TODO
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          status: IssueStatus.TODO,
        },
        _count: true,
      }),
      // 4. Completed today (status→DONE activities today)
      this.prisma.activity.groupBy({
        by: ['userId'],
        where: {
          field: 'status',
          newValue: IssueStatus.DONE,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _count: { _all: true },
      }),
      // 5. Overdue issues
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          dueDate: { lt: todayStart },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      // 6. Active issues (not DONE/CANCELED)
      this.prisma.issue.groupBy({
        by: ['assigneeId'],
        where: {
          assigneeId: { not: null },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      // 7. Historical issues (groupBy assigneeId + status)
      this.prisma.issue.groupBy({
        by: ['assigneeId', 'status'],
        where: { assigneeId: { not: null } },
        _count: true,
      }),
      // 8. Activity 24h
      this.prisma.activity.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: twentyFourHoursAgo } },
        _count: { _all: true },
      }),
      // 9. Unassigned issues
      this.prisma.issue.count({
        where: {
          assigneeId: null,
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
      }),
      // 10. Heatmap: active issues by assignee + project
      this.prisma.issue.groupBy({
        by: ['assigneeId', 'projectId'],
        where: {
          assigneeId: { not: null },
          status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
        },
        _count: true,
      }),
      // 11. Standup reports for today
      this.prisma.standupReport.findMany({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        include: {
          answers: {
            include: { question: true },
            orderBy: { order: 'asc' },
          },
          config: {
            select: { name: true },
          },
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

    // Historical: total & done per user
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

    // Heatmap data
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

    // Collect all projects from user memberships
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

    // Build members array
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

    // Summary
    const totalCompletedToday = completedToday.reduce(
      (sum, r) => sum + r._count._all,
      0,
    );
    const totalOverdue = overdueGrouped.reduce((sum, r) => sum + r._count, 0);

    // Standup summary
    const standupAnswered = todayReports.filter(
      (r) => r.status === 'ANSWERED',
    ).length;
    const standupUnanswered = todayReports.filter(
      (r) => r.status === 'UNANSWERED',
    ).length;

    // Map Slack users to system users
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
            .map((a) => ({
              question: a.question.text,
              answer: a.answer!,
            })),
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

  async getMyGlobalDashboard(userId: string) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Get all projects user is a member of
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          select: { id: true, name: true, key: true },
        },
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

    const [allMyIssues, overdueIssues, totalByProject, statusByProject, myByProject] = await Promise.all([
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
        take: DashboardService.MAX_MY_ISSUES,
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
      // Total issues per project (single groupBy instead of N counts)
      this.prisma.issue.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds } },
        _count: true,
      }),
      // Done issues per project
      this.prisma.issue.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, status: IssueStatus.DONE },
        _count: true,
      }),
      // My active issues per project
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

    // Build project stats from groupBy results
    const totalMap = new Map(totalByProject.map((r) => [r.projectId, r._count]));
    const doneMap = new Map(statusByProject.map((r) => [r.projectId, r._count]));
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

  private async getOverdueIssues(projectId: string) {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    return this.prisma.issue.findMany({
      where: {
        projectId,
        dueDate: { lt: now },
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
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });
  }
}
