import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLabelDto } from './dto/create-label.dto.js';
import type { UpdateLabelDto } from './dto/update-label.dto.js';

@Injectable()
export class LabelService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, dto: CreateLabelDto) {
    const existing = await this.prisma.label.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException(
        `Label "${dto.name}" already exists in this project`,
      );
    }

    return this.prisma.label.create({
      data: { ...dto, projectId },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.label.findMany({
      where: { projectId },
      include: { _count: { select: { issues: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async update(projectId: string, labelId: string, dto: UpdateLabelDto) {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label || label.projectId !== projectId) {
      throw new NotFoundException('Label not found');
    }

    if (dto.name && dto.name !== label.name) {
      const dup = await this.prisma.label.findUnique({
        where: { projectId_name: { projectId, name: dto.name } },
      });
      if (dup)
        throw new ConflictException(`Label "${dto.name}" already exists`);
    }

    return this.prisma.label.update({
      where: { id: labelId },
      data: dto,
    });
  }

  async remove(projectId: string, labelId: string) {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
    });
    if (!label || label.projectId !== projectId) {
      throw new NotFoundException('Label not found');
    }

    await this.prisma.label.delete({ where: { id: labelId } });
    return { deleted: true };
  }

  async seedDefaults(projectId: string) {
    const defaults = [
      { name: 'Bug', color: '#EF4444' },
      { name: 'Feature', color: '#3B82F6' },
      { name: 'Improvement', color: '#8B5CF6' },
      { name: 'Documentation', color: '#6B7280' },
      { name: 'Urgent', color: '#F59E0B' },
      { name: 'Design', color: '#EC4899' },
    ];

    const result = await this.prisma.label.createMany({
      data: defaults.map((label) => ({ ...label, projectId })),
      skipDuplicates: true,
    });

    // Return the created labels
    if (result.count > 0) {
      return this.prisma.label.findMany({
        where: {
          projectId,
          name: { in: defaults.map((d) => d.name) },
        },
      });
    }

    return [];
  }
}
