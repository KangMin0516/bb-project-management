import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssueService } from '../issue/issue.service.js';
import { SpecificationService } from '../specification/specification.service.js';
import type { ExternalCreateIssueDto } from './dto/external-create-issue.dto.js';
import type { ExternalUpdateIssueDto } from './dto/external-update-issue.dto.js';
import type { IssueStatus } from '../../generated/prisma/enums.js';
import { USER_SELECT } from '../common/constants.js';

const TERMINAL_STATUSES = new Set<string>(['DONE', 'CANCELED']);

@Injectable()
export class ExternalService {
  constructor(
    private prisma: PrismaService,
    private issueService: IssueService,
    private specificationService: SpecificationService,
  ) {}

  async createIssue(dto: ExternalCreateIssueDto, creatorId: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: dto.projectKey },
    });
    if (!project) {
      throw new NotFoundException(`Project "${dto.projectKey}" not found`);
    }

    // Resolve assignee by email
    let assigneeId: string | undefined;
    if (dto.assigneeEmail) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.assigneeEmail },
      });
      if (!user)
        throw new BadRequestException(`User "${dto.assigneeEmail}" not found`);
      assigneeId = user.id;
    }

    // Resolve labels by name
    let labelIds: string[] | undefined;
    if (dto.labels?.length) {
      const labels = await this.prisma.label.findMany({
        where: {
          projectId: project.id,
          name: { in: dto.labels },
        },
      });
      labelIds = labels.map((l) => l.id);
    }

    return this.issueService.create(
      project.id,
      {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        type: dto.type,
        assigneeId,
        parentId: dto.parentId,
        labelIds,
      },
      creatorId,
    );
  }

  async updateIssue(
    projectKey: string,
    issueNumber: number,
    dto: ExternalUpdateIssueDto,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
    });
    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );

    // Resolve assignee by email
    let assigneeId: string | null | undefined;
    if (dto.assigneeEmail !== undefined) {
      if (dto.assigneeEmail === null || dto.assigneeEmail === '') {
        assigneeId = null;
      } else {
        const user = await this.prisma.user.findUnique({
          where: { email: dto.assigneeEmail },
        });
        if (!user)
          throw new BadRequestException(
            `User "${dto.assigneeEmail}" not found`,
          );
        assigneeId = user.id;
      }
    }

    return this.issueService.update(
      project.id,
      issue.id,
      {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId,
      },
      userId,
    );
  }

  async getIssue(projectKey: string, issueNumber: number) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
        children: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );
    return issue;
  }

  async getDigest(projectKey: string, days = 7) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true, name: true, description: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const upcomingUntil = new Date(
      now.getTime() + days * 24 * 60 * 60 * 1000,
    );

    const issues = await this.prisma.issue.findMany({
      where: { projectId: project.id, archivedAt: null },
      include: {
        assignee: { select: USER_SELECT },
        labels: { include: { label: true } },
      },
    });

    const archivedCount = await this.prisma.issue.count({
      where: { projectId: project.id, archivedAt: { not: null } },
    });

    const counts = {
      total: issues.length,
      archived: archivedCount,
      byStatus: countBy(issues, (i) => i.status),
      byType: countBy(issues, (i) => i.type),
      byPriority: countBy(issues, (i) => i.priority),
    };

    const byAssigneeMap = new Map<
      string,
      {
        user: {
          id: string;
          email: string;
          name: string;
          avatar: string | null;
        };
        total: number;
        byStatus: Record<string, number>;
        overdue: number;
      }
    >();
    for (const issue of issues) {
      if (!issue.assignee) continue;
      const key = issue.assignee.id;
      let entry = byAssigneeMap.get(key);
      if (!entry) {
        entry = {
          user: issue.assignee,
          total: 0,
          byStatus: {},
          overdue: 0,
        };
        byAssigneeMap.set(key, entry);
      }
      entry.total += 1;
      entry.byStatus[issue.status] = (entry.byStatus[issue.status] ?? 0) + 1;
      if (
        issue.dueDate &&
        issue.dueDate < now &&
        !TERMINAL_STATUSES.has(issue.status)
      ) {
        entry.overdue += 1;
      }
    }
    const byAssignee = [...byAssigneeMap.values()].sort(
      (a, b) => b.total - a.total,
    );

    const summarize = (i: (typeof issues)[number]) => ({
      id: i.id,
      key: `${project.key}-${i.number}`,
      number: i.number,
      title: i.title,
      status: i.status,
      type: i.type,
      priority: i.priority,
      dueDate: i.dueDate,
      assignee: i.assignee
        ? {
            id: i.assignee.id,
            name: i.assignee.name,
            email: i.assignee.email,
          }
        : null,
    });

    const overdue = issues
      .filter(
        (i) =>
          i.dueDate &&
          i.dueDate < now &&
          !TERMINAL_STATUSES.has(i.status),
      )
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .map(summarize);

    const upcomingDue = issues
      .filter(
        (i) =>
          i.dueDate &&
          i.dueDate >= now &&
          i.dueDate <= upcomingUntil &&
          !TERMINAL_STATUSES.has(i.status),
      )
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .map(summarize);

    const recentlyCreated = issues
      .filter((i) => i.createdAt >= since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50)
      .map(summarize);

    const recentlyCompleted = issues
      .filter((i) => i.status === 'DONE' && i.updatedAt >= since)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 50)
      .map(summarize);

    const recentActivity = await this.prisma.activity.findMany({
      where: {
        issue: { projectId: project.id },
        createdAt: { gte: since },
        field: { in: ['status', 'assigneeId', 'created'] },
      },
      include: {
        user: { select: USER_SELECT },
        issue: {
          select: { id: true, number: true, title: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      project: {
        key: project.key,
        name: project.name,
        description: project.description,
      },
      generatedAt: now.toISOString(),
      windowDays: days,
      counts,
      byAssignee,
      overdue,
      upcomingDue,
      recentlyCreated,
      recentlyCompleted,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
        createdAt: a.createdAt,
        user: a.user
          ? { id: a.user.id, name: a.user.name, email: a.user.email }
          : null,
        issue: a.issue
          ? {
              key: `${project.key}-${a.issue.number}`,
              number: a.issue.number,
              title: a.issue.title,
              type: a.issue.type,
            }
          : null,
      })),
    };
  }

  async listIssues(projectKey: string, status?: string, page = 1, limit = 50) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const where = {
      projectId: project.id,
      ...(status && { status: status as IssueStatus }),
    };

    const [items, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        include: {
          assignee: { select: { id: true, email: true, name: true } },
          labels: { include: { label: true } },
        },
        orderBy: [{ status: 'asc' }, { order: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listSpecs(projectKey: string, category?: string, status?: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    return this.specificationService.findAll(project.id, { category, status });
  }

  async getSpec(projectKey: string, specId: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    return this.specificationService.findOne(project.id, specId);
  }

  async getSpecMarkdown(projectKey: string, specId: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    return this.specificationService.exportOne(project.id, specId);
  }
}

function countBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}
