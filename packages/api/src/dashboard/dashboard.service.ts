import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import { IssueStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getProjectStats(projectId: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const [
      totalIssues,
      byStatus,
      byPriority,
      byType,
      byAssignee,
      recentActivities,
      memberCount,
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
    ]);

    // Resolve assignee names
    const assigneeIds = byAssignee
      .map((a) => a.assigneeId)
      .filter((id): id is string => id !== null);

    const assignees = assigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, avatar: true },
        })
      : [];

    const assigneeMap = new Map(assignees.map((a) => [a.id, a]));

    const myIssues = userId
      ? await this.prisma.issue.findMany({
          where: {
            projectId,
            assigneeId: userId,
            status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELED] },
          },
          include: {
            assignee: { select: USER_SELECT },
            creator: { select: USER_SELECT },
            labels: { include: { label: true } },
            parent: { select: { id: true, number: true, title: true } },
            _count: { select: { children: true } },
          },
          orderBy: [
            { dueDate: { sort: 'asc', nulls: 'last' } },
            { priority: 'asc' },
            { createdAt: 'desc' },
          ],
          take: 100,
        })
      : [];

    return {
      project: { id: project.id, name: project.name, key: project.key },
      totalIssues,
      memberCount,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count,
      })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byAssignee: byAssignee.map((a) => ({
        assignee: assigneeMap.get(a.assigneeId!) ?? null,
        count: a._count,
      })),
      recentActivities,
      myIssues,
    };
  }
}
