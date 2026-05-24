import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const ISSUE_SELECT = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  assigneeId: true,
} as const;

/**
 * Link / unlink an Issue to a SpecItem (a single checkbox-line requirement
 * inside a Specification). Sits next to `IssueSpecLinkService` (spec-level
 * links) and uses the same ownership-check shape — both the spec item and the
 * issue must belong to the route's `projectId` or we throw 404 to avoid
 * leaking cross-project IDs.
 */
@Injectable()
export class SpecItemIssueLinkService {
  constructor(private prisma: PrismaService) {}

  async create(
    projectId: string,
    specId: string,
    itemId: string,
    issueId: string,
  ) {
    const [item, issue] = await Promise.all([
      this.prisma.specItem.findUnique({
        where: { id: itemId },
        select: { id: true, specId: true, spec: { select: { projectId: true } } },
      }),
      this.prisma.issue.findUnique({
        where: { id: issueId },
        select: { id: true, projectId: true },
      }),
    ]);

    if (!item || item.specId !== specId || item.spec.projectId !== projectId) {
      throw new NotFoundException('SpecItem not found');
    }
    if (!issue || issue.projectId !== projectId) {
      throw new NotFoundException('Issue not found');
    }

    try {
      return await this.prisma.specItemIssueLink.create({
        data: { specItemId: itemId, issueId },
        include: { issue: { select: ISSUE_SELECT } },
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

  async remove(
    projectId: string,
    specId: string,
    itemId: string,
    linkId: string,
  ) {
    const link = await this.prisma.specItemIssueLink.findUnique({
      where: { id: linkId },
      include: {
        specItem: {
          select: { id: true, specId: true, spec: { select: { projectId: true } } },
        },
      },
    });

    if (
      !link ||
      link.specItemId !== itemId ||
      link.specItem.specId !== specId ||
      link.specItem.spec.projectId !== projectId
    ) {
      throw new NotFoundException('Link not found');
    }

    await this.prisma.specItemIssueLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }
}
