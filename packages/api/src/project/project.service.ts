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

    return this.prisma.project.create({
      data: {
        ...dto,
        members: {
          create: {
            userId: creatorId,
            role: ProjectRole.ADMIN,
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
        },
        _count: { select: { issues: true } },
      },
    });
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

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
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
          include: { user: { select: { id: true, email: true, name: true, avatar: true } } },
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
