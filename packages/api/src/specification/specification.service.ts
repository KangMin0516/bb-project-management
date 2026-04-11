import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { SpecStatus } from '../../generated/prisma/enums.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateSpecificationDto } from './dto/create-specification.dto.js';
import type { UpdateSpecificationDto } from './dto/update-specification.dto.js';
import type {
  CreateSpecCommentDto,
  UpdateSpecCommentDto,
} from './dto/create-spec-comment.dto.js';

@Injectable()
export class SpecificationService {
  constructor(private prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────

  private parseSections(content: string) {
    const lines = content.split('\n');
    const sections: {
      sectionId: string;
      level: number;
      title: string;
      order: number;
    }[] = [];
    let order = 0;
    const slugCounts = new Map<string, number>();

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        const baseSlug = title
          .toLowerCase()
          .replace(/[^a-z0-9가-힣\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 100);
        if (!baseSlug) continue;

        // C3: Handle duplicate slugs by appending suffix
        const count = slugCounts.get(baseSlug) || 0;
        slugCounts.set(baseSlug, count + 1);
        const sectionId = count > 0 ? `${baseSlug}-${count}` : baseSlug;

        sections.push({ sectionId, level, title, order: order++ });
      }
    }
    return sections;
  }

  private async syncSections(
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
    specId: string,
    content: string,
  ) {
    const parsed = this.parseSections(content);

    // Delete removed sections, upsert existing — all in one transaction
    await tx.specSection.deleteMany({
      where: {
        specId,
        sectionId: { notIn: parsed.map((s) => s.sectionId) },
      },
    });

    for (const sec of parsed) {
      await tx.specSection.upsert({
        where: {
          specId_sectionId: { specId, sectionId: sec.sectionId },
        },
        create: {
          specId,
          sectionId: sec.sectionId,
          level: sec.level,
          title: sec.title,
          order: sec.order,
        },
        update: {
          level: sec.level,
          title: sec.title,
          order: sec.order,
        },
      });
    }
  }

  private async findSpecOrThrow(specId: string, projectId: string) {
    const spec = await this.prisma.specification.findUnique({
      where: { id: specId },
      select: { id: true, projectId: true },
    });
    if (!spec || spec.projectId !== projectId) {
      throw new NotFoundException('Specification not found');
    }
    return spec;
  }

  // ─── Specification CRUD ──────────────────────────────────

  async create(projectId: string, userId: string, dto: CreateSpecificationDto) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await tx.specification.create({
        data: {
          title: dto.title,
          content: dto.content,
          category: dto.category,
          status: dto.status,
          projectId,
          creatorId: userId,
        },
        include: {
          creator: { select: USER_SELECT },
        },
      });

      await this.syncSections(tx, spec.id, dto.content);
      return spec;
    });
  }

  async findAll(
    projectId: string,
    query?: { category?: string; status?: string },
  ) {
    const where: {
      projectId: string;
      category?: string;
      status?: SpecStatus;
    } = { projectId };
    if (query?.category) where.category = query.category;
    if (query?.status) where.status = query.status as SpecStatus;

    return this.prisma.specification.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        order: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: USER_SELECT },
        _count: { select: { comments: { where: { resolved: false } } } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(projectId: string, specId: string) {
    const spec = await this.prisma.specification.findUnique({
      where: { id: specId },
      include: {
        creator: { select: USER_SELECT },
        sections: { orderBy: { order: 'asc' } },
        comments: {
          where: { parentId: null },
          include: {
            user: { select: USER_SELECT },
            section: { select: { id: true, sectionId: true, title: true } },
            replies: {
              include: { user: { select: USER_SELECT } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        issueLinks: {
          include: {
            issue: {
              select: { id: true, number: true, title: true, status: true, priority: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!spec || spec.projectId !== projectId) {
      throw new NotFoundException('Specification not found');
    }

    return spec;
  }

  async update(projectId: string, specId: string, dto: UpdateSpecificationDto) {
    await this.findSpecOrThrow(specId, projectId);

    return this.prisma.$transaction(async (tx) => {
      const spec = await tx.specification.update({
        where: { id: specId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.content !== undefined && { content: dto.content }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        include: { creator: { select: USER_SELECT } },
      });

      if (dto.content !== undefined) {
        await this.syncSections(tx, specId, dto.content);
      }

      return spec;
    });
  }

  async remove(projectId: string, specId: string) {
    await this.findSpecOrThrow(specId, projectId);
    await this.prisma.specification.delete({ where: { id: specId } });
    return { deleted: true };
  }

  // ─── Download ───────────────────────────────────────────

  async exportOne(projectId: string, specId: string) {
    const spec = await this.prisma.specification.findUnique({
      where: { id: specId },
      select: { title: true, content: true, category: true, status: true, projectId: true, order: true },
    });
    if (!spec || spec.projectId !== projectId) {
      throw new NotFoundException('Specification not found');
    }
    const filename = spec.title
      .replace(/[^a-zA-Z0-9가-힣\s_-]/g, '')
      .replace(/\s+/g, '_');
    return { filename, content: spec.content, category: spec.category, status: spec.status, order: spec.order };
  }

  async exportAll(projectId: string) {
    const specs = await this.prisma.specification.findMany({
      where: { projectId },
      select: { title: true, content: true, category: true, status: true, order: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    return specs.map((spec) => {
      const filename = spec.title
        .replace(/[^a-zA-Z0-9가-힣\s_-]/g, '')
        .replace(/\s+/g, '_');
      return { filename, content: spec.content, category: spec.category, status: spec.status, order: spec.order };
    });
  }

  // ─── Comments ────────────────────────────────────────────

  async createComment(
    projectId: string,
    specId: string,
    userId: string,
    dto: CreateSpecCommentDto,
  ) {
    await this.findSpecOrThrow(specId, projectId);

    // C1: Validate parentId belongs to same spec
    if (dto.parentId) {
      const parent = await this.prisma.specComment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.specId !== specId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Resolve section reference
    let sectionDbId: string | undefined;
    if (dto.sectionId) {
      const section = await this.prisma.specSection.findUnique({
        where: { specId_sectionId: { specId, sectionId: dto.sectionId } },
      });
      if (section) sectionDbId = section.id;
    }

    return this.prisma.specComment.create({
      data: {
        content: dto.content,
        specId,
        sectionId: sectionDbId,
        userId,
        parentId: dto.parentId,
      },
      include: {
        user: { select: USER_SELECT },
        section: { select: { id: true, sectionId: true, title: true } },
        replies: {
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findComments(projectId: string, specId: string, sectionId?: string) {
    await this.findSpecOrThrow(specId, projectId);

    const where: {
      specId: string;
      parentId: null;
      sectionId?: string;
    } = { specId, parentId: null };
    if (sectionId) {
      const section = await this.prisma.specSection.findUnique({
        where: { specId_sectionId: { specId, sectionId } },
      });
      if (!section) return []; // W2: Return empty when section not found
      where.sectionId = section.id;
    }

    return this.prisma.specComment.findMany({
      where,
      include: {
        user: { select: USER_SELECT },
        section: { select: { id: true, sectionId: true, title: true } },
        replies: {
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateComment(
    projectId: string,
    specId: string,
    commentId: string,
    userId: string,
    dto: UpdateSpecCommentDto,
  ) {
    await this.findSpecOrThrow(specId, projectId);

    const comment = await this.prisma.specComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.specId !== specId) {
      throw new NotFoundException('Comment not found');
    }

    // Only author can edit content; anyone can toggle resolved
    if (dto.content !== undefined && comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.specComment.update({
      where: { id: commentId },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.resolved !== undefined && { resolved: dto.resolved }),
      },
      include: {
        user: { select: USER_SELECT },
        section: { select: { id: true, sectionId: true, title: true } },
        replies: {
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async removeComment(
    projectId: string,
    specId: string,
    commentId: string,
    userId: string,
  ) {
    await this.findSpecOrThrow(specId, projectId);

    const comment = await this.prisma.specComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.specId !== specId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.specComment.delete({ where: { id: commentId } });
    return { deleted: true };
  }
}
