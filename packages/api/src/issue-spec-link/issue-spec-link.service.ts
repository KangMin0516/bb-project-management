import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateIssueSpecLinkDto } from './dto/create-issue-spec-link.dto.js';

const SPEC_SELECT = {
  id: true,
  title: true,
  status: true,
  category: true,
} as const;

const ISSUE_SELECT = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
} as const;

@Injectable()
export class IssueSpecLinkService {
  constructor(private prisma: PrismaService) {}

  async create(
    projectId: string,
    issueId: string,
    dto: CreateIssueSpecLinkDto,
  ) {
    const [issue, spec] = await Promise.all([
      this.prisma.issue.findUnique({
        where: { id: issueId },
        select: { id: true, projectId: true },
      }),
      this.prisma.specification.findUnique({
        where: { id: dto.specId },
        select: { id: true, projectId: true },
      }),
    ]);

    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }
    if (!spec || spec.projectId !== projectId) {
      throw new NotFoundException('Specification not found');
    }

    try {
      return await this.prisma.issueSpecLink.create({
        data: {
          issueId,
          specId: dto.specId,
          sectionSlug: dto.sectionSlug || '',
        },
        include: {
          spec: { select: SPEC_SELECT },
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('This link already exists');
      }
      throw error;
    }
  }

  async findByIssue(projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { projectId: true },
    });

    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }

    return this.prisma.issueSpecLink.findMany({
      where: { issueId },
      include: {
        spec: { select: SPEC_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySpec(specId: string) {
    return this.prisma.issueSpecLink.findMany({
      where: { specId },
      include: {
        issue: { select: ISSUE_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(projectId: string, issueId: string, linkId: string) {
    const link = await this.prisma.issueSpecLink.findUnique({
      where: { id: linkId },
      include: { issue: { select: { projectId: true, id: true } } },
    });

    if (
      !link ||
      link.issue.projectId !== projectId ||
      link.issue.id !== issueId
    ) {
      throw new NotFoundException('Link not found');
    }

    await this.prisma.issueSpecLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }
}
