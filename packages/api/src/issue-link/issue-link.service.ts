import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssueLinkType } from '../../generated/prisma/enums.js';
import type { CreateIssueLinkDto } from './dto/create-issue-link.dto.js';

const REVERSE_TYPE: Record<IssueLinkType, IssueLinkType> = {
  [IssueLinkType.BLOCKS]: IssueLinkType.IS_BLOCKED_BY,
  [IssueLinkType.IS_BLOCKED_BY]: IssueLinkType.BLOCKS,
  [IssueLinkType.DUPLICATES]: IssueLinkType.IS_DUPLICATED_BY,
  [IssueLinkType.IS_DUPLICATED_BY]: IssueLinkType.DUPLICATES,
  [IssueLinkType.RELATES_TO]: IssueLinkType.RELATES_TO,
};

const ISSUE_LINK_SELECT = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  type: true,
  project: { select: { key: true } },
} as const;

@Injectable()
export class IssueLinkService {
  constructor(private prisma: PrismaService) {}

  async create(sourceIssueId: string, dto: CreateIssueLinkDto, userId: string) {
    if (sourceIssueId === dto.targetIssueId) {
      throw new BadRequestException('An issue cannot link to itself');
    }

    const [source, target] = await Promise.all([
      this.prisma.issue.findUnique({
        where: { id: sourceIssueId },
        select: { id: true, projectId: true },
      }),
      this.prisma.issue.findUnique({
        where: { id: dto.targetIssueId },
        select: { id: true, projectId: true },
      }),
    ]);

    if (!source) throw new NotFoundException('Source issue not found');
    if (!target) throw new NotFoundException('Target issue not found');

    if (source.projectId !== target.projectId) {
      throw new BadRequestException('Both issues must be in the same project');
    }

    const existing = await this.prisma.issueLink.findUnique({
      where: {
        sourceIssueId_targetIssueId_type: {
          sourceIssueId,
          targetIssueId: dto.targetIssueId,
          type: dto.type,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('This link already exists');
    }

    const reverseType = REVERSE_TYPE[dto.type];

    const link = await this.prisma.$transaction(async (tx) => {
      const created = await tx.issueLink.create({
        data: {
          sourceIssueId,
          targetIssueId: dto.targetIssueId,
          type: dto.type,
          creatorId: userId,
        },
        include: {
          targetIssue: { select: ISSUE_LINK_SELECT },
          creator: { select: { id: true, name: true } },
        },
      });

      await tx.issueLink.upsert({
        where: {
          sourceIssueId_targetIssueId_type: {
            sourceIssueId: dto.targetIssueId,
            targetIssueId: sourceIssueId,
            type: reverseType,
          },
        },
        create: {
          sourceIssueId: dto.targetIssueId,
          targetIssueId: sourceIssueId,
          type: reverseType,
          creatorId: userId,
        },
        update: {},
      });

      return created;
    });

    return link;
  }

  async findByIssue(issueId: string) {
    const [sourceLinks, targetLinks] = await Promise.all([
      this.prisma.issueLink.findMany({
        where: { sourceIssueId: issueId },
        include: {
          targetIssue: { select: ISSUE_LINK_SELECT },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.issueLink.findMany({
        where: { targetIssueId: issueId },
        include: {
          sourceIssue: { select: ISSUE_LINK_SELECT },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { sourceLinks, targetLinks };
  }

  async findProjectDependencies(projectId: string) {
    // Fetch all BLOCKS links where either source or target belongs to this project.
    // The reverse IS_BLOCKED_BY links are auto-created, so we only need BLOCKS
    // to reconstruct the full dependency graph.
    const links = await this.prisma.issueLink.findMany({
      where: {
        type: 'BLOCKS',
        OR: [{ sourceIssue: { projectId } }, { targetIssue: { projectId } }],
      },
      include: {
        sourceIssue: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            project: { select: { key: true } },
          },
        },
        targetIssue: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            project: { select: { key: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links;
  }

  async remove(linkId: string, _userId: string) {
    const link = await this.prisma.issueLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    const reverseType = REVERSE_TYPE[link.type];

    await this.prisma.$transaction(async (tx) => {
      await tx.issueLink.delete({ where: { id: linkId } });

      await tx.issueLink.deleteMany({
        where: {
          sourceIssueId: link.targetIssueId,
          targetIssueId: link.sourceIssueId,
          type: reverseType,
        },
      });
    });

    return { deleted: true };
  }
}
