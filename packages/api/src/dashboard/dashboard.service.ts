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
      entry.statuses[row.status] = (entry.statuses[row.status] || 0) + row._count;
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

    // Get all issues in the project with their creation and completion info
    const issues = await this.prisma.issue.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get status-change activities to DONE/CANCELED within the window
    const doneActivities = await this.prisma.activity.findMany({
      where: {
        issue: { projectId },
        field: 'status',
        newValue: { in: ['DONE', 'CANCELED'] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        issueId: true,
        newValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build a map: issueId -> earliest date it was marked DONE/CANCELED
    const closedDateMap = new Map<string, Date>();
    for (const act of doneActivities) {
      if (!closedDateMap.has(act.issueId)) {
        closedDateMap.set(act.issueId, act.createdAt);
      }
    }

    // For issues currently DONE/CANCELED that have no activity record in window,
    // use their updatedAt as approximation
    for (const issue of issues) {
      if (
        (issue.status === IssueStatus.DONE ||
          issue.status === IssueStatus.CANCELED) &&
        !closedDateMap.has(issue.id)
      ) {
        closedDateMap.set(issue.id, issue.updatedAt);
      }
    }

    const result: { date: string; openCount: number }[] = [];
    for (let d = 0; d < 30; d++) {
      const day = new Date(thirtyDaysAgo);
      day.setUTCDate(day.getUTCDate() + d);
      const dayEnd = new Date(day);
      dayEnd.setUTCHours(23, 59, 59, 999);

      let openCount = 0;
      for (const issue of issues) {
        // Issue must have been created on or before this day
        if (issue.createdAt > dayEnd) continue;
        // Check if it was closed by this day
        const closedDate = closedDateMap.get(issue.id);
        if (closedDate && closedDate <= dayEnd) continue;
        openCount++;
      }

      result.push({
        date: day.toISOString().slice(0, 10),
        openCount,
      });
    }

    return result;
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
