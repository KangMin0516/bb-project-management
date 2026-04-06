import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExternalCreateIssueDto } from './dto/external-create-issue.dto.js';
import type { ExternalUpdateIssueDto } from './dto/external-update-issue.dto.js';

const ORDER_GAP = 1000;

@Injectable()
export class ExternalService {
  constructor(private prisma: PrismaService) {}

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
      if (!user) throw new BadRequestException(`User "${dto.assigneeEmail}" not found`);
      assigneeId = user.id;
    }

    // Resolve labels by name
    let labelIds: string[] = [];
    if (dto.labels?.length) {
      const labels = await this.prisma.label.findMany({
        where: {
          projectId: project.id,
          name: { in: dto.labels },
        },
      });
      labelIds = labels.map((l) => l.id);
    }

    // Auto-increment number
    const lastIssue = await this.prisma.issue.findFirst({
      where: { projectId: project.id },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (lastIssue?.number ?? 0) + 1;

    const status = dto.status ?? 'BACKLOG';
    const lastInColumn = await this.prisma.issue.findFirst({
      where: { projectId: project.id, status: status as any },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = (lastInColumn?.order ?? 0) + ORDER_GAP;

    const issue = await this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: status as any,
        priority: dto.priority ?? 'MEDIUM',
        type: dto.type ?? 'TASK',
        number,
        order,
        projectId: project.id,
        creatorId,
        assigneeId,
        parentId: dto.parentId,
        ...(labelIds.length && {
          labels: { create: labelIds.map((id) => ({ labelId: id })) },
        }),
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
        project: { select: { id: true, key: true, name: true } },
      },
    });

    return issue;
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
    if (!project) throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: { projectId_number: { projectId: project.id, number: issueNumber } },
    });
    if (!issue) throw new NotFoundException(`Issue ${projectKey}-${issueNumber} not found`);

    // Resolve assignee
    let assigneeId: string | null | undefined;
    if (dto.assigneeEmail !== undefined) {
      if (dto.assigneeEmail === null || dto.assigneeEmail === '') {
        assigneeId = null;
      } else {
        const user = await this.prisma.user.findUnique({
          where: { email: dto.assigneeEmail },
        });
        if (!user) throw new BadRequestException(`User "${dto.assigneeEmail}" not found`);
        assigneeId = user.id;
      }
    }

    // Track activities
    const activities: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    const changes: Record<string, any> = {};

    if (dto.title !== undefined && dto.title !== issue.title) {
      activities.push({ field: 'title', oldValue: issue.title, newValue: dto.title });
      changes.title = dto.title;
    }
    if (dto.description !== undefined && dto.description !== issue.description) {
      activities.push({ field: 'description', oldValue: issue.description, newValue: dto.description });
      changes.description = dto.description;
    }
    if (dto.status !== undefined && dto.status !== issue.status) {
      activities.push({ field: 'status', oldValue: issue.status, newValue: dto.status });
      changes.status = dto.status;
    }
    if (dto.priority !== undefined && dto.priority !== issue.priority) {
      activities.push({ field: 'priority', oldValue: issue.priority, newValue: dto.priority });
      changes.priority = dto.priority;
    }
    if (assigneeId !== undefined && assigneeId !== issue.assigneeId) {
      activities.push({ field: 'assigneeId', oldValue: issue.assigneeId, newValue: assigneeId });
      changes.assigneeId = assigneeId;
    }

    return this.prisma.issue.update({
      where: { id: issue.id },
      data: {
        ...changes,
        ...(activities.length > 0 && {
          activities: {
            create: activities.map((a) => ({ ...a, userId })),
          },
        }),
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
        project: { select: { id: true, key: true, name: true } },
      },
    });
  }

  async getIssue(projectKey: string, issueNumber: number) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project) throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: { projectId_number: { projectId: project.id, number: issueNumber } },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
        children: {
          select: { id: true, number: true, title: true, status: true, priority: true },
        },
      },
    });

    if (!issue) throw new NotFoundException(`Issue ${projectKey}-${issueNumber} not found`);
    return issue;
  }

  async listIssues(projectKey: string, status?: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: projectKey },
    });
    if (!project) throw new NotFoundException(`Project "${projectKey}" not found`);

    return this.prisma.issue.findMany({
      where: {
        projectId: project.id,
        ...(status && { status: status as any }),
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
      },
      orderBy: [{ status: 'asc' }, { order: 'asc' }],
    });
  }
}
