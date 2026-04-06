import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssueService } from '../issue/issue.service.js';
import type { ExternalCreateIssueDto } from './dto/external-create-issue.dto.js';
import type { ExternalUpdateIssueDto } from './dto/external-update-issue.dto.js';
import type { IssueStatus } from '../../generated/prisma/enums.js';

@Injectable()
export class ExternalService {
  constructor(
    private prisma: PrismaService,
    private issueService: IssueService,
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
      if (!user) throw new BadRequestException(`User "${dto.assigneeEmail}" not found`);
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
    if (!project) throw new NotFoundException(`Project "${projectKey}" not found`);

    const issue = await this.prisma.issue.findUnique({
      where: { projectId_number: { projectId: project.id, number: issueNumber } },
    });
    if (!issue) throw new NotFoundException(`Issue ${projectKey}-${issueNumber} not found`);

    // Resolve assignee by email
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
        ...(status && { status: status as IssueStatus }),
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        labels: { include: { label: true } },
      },
      orderBy: [{ status: 'asc' }, { order: 'asc' }],
    });
  }
}
