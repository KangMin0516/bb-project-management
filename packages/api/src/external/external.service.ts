import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateIssueUseCase } from '../issue/application/create-issue.use-case.js';
import { UpdateIssueUseCase } from '../issue/application/update-issue.use-case.js';
import { SpecificationService } from '../specification/specification.service.js';
import { IssueSpecLinkService } from '../issue-spec-link/issue-spec-link.service.js';
import { CommentService } from '../comment/comment.service.js';
import type { ExternalCreateIssueDto } from './dto/external-create-issue.dto.js';
import type { ExternalUpdateIssueDto } from './dto/external-update-issue.dto.js';
import type { ExternalCreateSpecDto } from './dto/external-create-spec.dto.js';
import type { ExternalUpdateSpecDto } from './dto/external-update-spec.dto.js';
import type { ExternalCreateIssueSpecLinkDto } from './dto/external-create-issue-spec-link.dto.js';
import type { ExternalCreateCommentDto } from './dto/external-create-comment.dto.js';
import { SpecStatus, type IssueStatus } from '../../generated/prisma/enums.js';
import { USER_SELECT } from '../common/constants.js';

const TERMINAL_STATUSES = new Set<string>(['DONE', 'CANCELED']);

@Injectable()
export class ExternalService {
  constructor(
    private prisma: PrismaService,
    private createIssueUC: CreateIssueUseCase,
    private updateIssueUC: UpdateIssueUseCase,
    private specificationService: SpecificationService,
    private issueSpecLinkService: IssueSpecLinkService,
    private commentService: CommentService,
  ) {}

  private async resolveProjectAndIssue(
    projectKey: string,
    issueNumber: number,
  ): Promise<{ projectId: string; issueId: string }> {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);
    const issue = await this.prisma.issue.findUnique({
      where: {
        projectId_number: { projectId: project.id, number: issueNumber },
      },
      select: { id: true },
    });
    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );
    return { projectId: project.id, issueId: issue.id };
  }

  async createIssue(
    dto: ExternalCreateIssueDto,
    creatorId: string,
    source?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: dto.projectKey },
    });
    if (!project) {
      throw new NotFoundException(`Project "${dto.projectKey}" not found`);
    }

    // Resolve assignee — `assigneeId` (UUID from list_members) wins over
    // `assigneeEmail` (email lookup) when both are sent.
    let assigneeId: string | undefined;
    if (dto.assigneeId) {
      assigneeId = dto.assigneeId;
    } else if (dto.assigneeEmail) {
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

    return this.createIssueUC.execute({
      projectId: project.id,
      creatorId,
      title: dto.title,
      description: dto.description,
      status: dto.status,
      priority: dto.priority,
      type: dto.type,
      assigneeId: assigneeId ?? undefined,
      parentId: dto.parentId,
      startDate: dto.startDate,
      dueDate: dto.dueDate,
      labelIds,
      source: source as import('../common/source.js').SourceLiteral | undefined,
    });
  }

  async updateIssue(
    projectKey: string,
    issueNumber: number,
    dto: ExternalUpdateIssueDto,
    userId: string,
    source?: string,
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

    // Resolve assignee — `assigneeId` wins over `assigneeEmail`. Both
    // accept null/empty to clear the assignee.
    let assigneeId: string | null | undefined;
    if (dto.assigneeId !== undefined) {
      assigneeId = dto.assigneeId;
    } else if (dto.assigneeEmail !== undefined) {
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

    return this.updateIssueUC.execute({
      projectId: project.id,
      issueId: issue.id,
      actorId: userId,
      source: source as import('../common/source.js').SourceLiteral | undefined,
      changes: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId,
        parentId: dto.parentId,
        startDate: dto.startDate,
        dueDate: dto.dueDate,
      },
    });
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
        // Last 50 comments + activities included inline so LLM clients
        // (bbpm-internal-mcp) get a usable summary in one round-trip.
        // Pagination beyond that uses the dedicated /comments and
        // /activities endpoints below.
        comments: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        activities: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!issue)
      throw new NotFoundException(
        `Issue ${projectKey}-${issueNumber} not found`,
      );
    return issue;
  }

  async listComments(
    projectKey: string,
    issueNumber: number,
    page = 1,
    limit = 50,
  ) {
    const { issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { issueId },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.comment.count({ where: { issueId } }),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async listActivities(
    projectKey: string,
    issueNumber: number,
    page = 1,
    limit = 50,
  ) {
    const { issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { issueId },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.activity.count({ where: { issueId } }),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
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
    const upcomingUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

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
        (i) => i.dueDate && i.dueDate < now && !TERMINAL_STATUSES.has(i.status),
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

  async createSpec(
    projectKey: string,
    dto: ExternalCreateSpecDto,
    creatorId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.specificationService.create(project.id, creatorId, {
      title: dto.title,
      content: dto.content,
      category: dto.category,
      status: dto.status ?? SpecStatus.DRAFT,
    });
  }

  async updateSpec(
    projectKey: string,
    specId: string,
    dto: ExternalUpdateSpecDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.specificationService.update(project.id, specId, dto);
  }

  async createIssueSpecLink(
    projectKey: string,
    issueNumber: number,
    dto: ExternalCreateIssueSpecLinkDto,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.issueSpecLinkService.create(projectId, issueId, dto);
  }

  async listIssueSpecLinks(projectKey: string, issueNumber: number) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.issueSpecLinkService.findByIssue(projectId, issueId);
  }

  async deleteIssueSpecLink(
    projectKey: string,
    issueNumber: number,
    linkId: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.issueSpecLinkService.remove(projectId, issueId, linkId);
  }

  // ─── New: comment + project meta (Phase 1 for bbpm-internal-mcp) ──

  async createComment(
    projectKey: string,
    issueNumber: number,
    dto: ExternalCreateCommentDto,
    userId: string,
    source?: string,
  ) {
    const { projectId, issueId } = await this.resolveProjectAndIssue(
      projectKey,
      issueNumber,
    );
    return this.commentService.create(
      projectId,
      issueId,
      userId,
      {
        content: dto.content,
        mentionedUserIds: dto.mentionedUserIds,
      },
      source,
    );
  }

  /**
   * Projects the calling user is a member of. The MCP server uses this
   * to populate the `list_projects` tool — the LLM needs a list of keys
   * before it can pick one for create/update/list operations.
   */
  async listProjectsForUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return projects;
  }

  async listMembers(projectKey: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
    }));
  }

  async listLabels(projectKey: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.prisma.label.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
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
