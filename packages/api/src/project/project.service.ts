import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectRole } from '../../generated/prisma/enums.js';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProjectDto, creatorId: string) {
    const existing = await this.prisma.project.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException(`Project key "${dto.key}" already exists`);
    }

    // Collect member creates: creator + all superusers
    const superusers = await this.prisma.user.findMany({
      where: { isSuperuser: true, status: 'ACTIVE' },
      select: { id: true },
    });

    const memberUserIds = new Set([creatorId, ...superusers.map((u) => u.id)]);

    const project = await this.prisma.project.create({
      data: {
        ...dto,
        members: {
          create: [...memberUserIds].map((userId) => ({
            userId,
            role: ProjectRole.ADMIN,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        _count: { select: { issues: true } },
      },
    });

    // Seed default labels
    const defaultLabels = [
      { name: 'Bug', color: '#EF4444' },
      { name: 'Feature', color: '#3B82F6' },
      { name: 'Improvement', color: '#8B5CF6' },
      { name: 'Documentation', color: '#6B7280' },
      { name: 'Urgent', color: '#F59E0B' },
      { name: 'Design', color: '#EC4899' },
    ];

    await this.prisma.label.createMany({
      data: defaultLabels.map((label) => ({ ...label, projectId: project.id })),
      skipDuplicates: true,
    });

    return project;
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        _count: { select: { issues: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllWithJoinStatus(userId: string) {
    const projects = await this.prisma.project.findMany({
      include: {
        _count: { select: { issues: true, members: true } },
        members: {
          where: { userId },
          select: { id: true, role: true },
          take: 1,
        },
        joinRequests: {
          where: { requesterId: userId, status: 'PENDING' },
          select: { id: true, status: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      _count: p._count,
      isMember: p.members.length > 0,
      myRole: p.members[0]?.role ?? null,
      pendingJoinRequest: p.joinRequests[0] ?? null,
    }));
  }

  async findOne(idOrKey: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
    const project = await this.prisma.project.findUnique({
      where: isUuid ? { id: idOrKey } : { key: idOrKey },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        labels: true,
        _count: { select: { issues: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureExists(id);

    return this.prisma.project.update({
      where: { id },
      data: dto,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        _count: { select: { issues: true } },
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
