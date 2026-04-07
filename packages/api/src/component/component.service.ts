import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateComponentDto } from './dto/create-component.dto.js';
import type { UpdateComponentDto } from './dto/update-component.dto.js';

@Injectable()
export class ComponentService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, dto: CreateComponentDto) {
    const existing = await this.prisma.component.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException(
        `Component "${dto.name}" already exists in this project`,
      );
    }

    return this.prisma.component.create({
      data: { ...dto, projectId },
      include: {
        lead: { select: USER_SELECT },
        defaultAssignee: { select: USER_SELECT },
        _count: { select: { issues: true } },
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.component.findMany({
      where: { projectId },
      include: {
        lead: { select: USER_SELECT },
        defaultAssignee: { select: USER_SELECT },
        _count: { select: { issues: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(projectId: string, componentId: string) {
    const component = await this.prisma.component.findUnique({
      where: { id: componentId },
      include: {
        lead: { select: USER_SELECT },
        defaultAssignee: { select: USER_SELECT },
        _count: { select: { issues: true } },
      },
    });

    if (!component || component.projectId !== projectId) {
      throw new NotFoundException('Component not found');
    }

    return component;
  }

  async update(projectId: string, componentId: string, dto: UpdateComponentDto) {
    const component = await this.prisma.component.findUnique({
      where: { id: componentId },
    });

    if (!component || component.projectId !== projectId) {
      throw new NotFoundException('Component not found');
    }

    if (dto.name && dto.name !== component.name) {
      const dup = await this.prisma.component.findUnique({
        where: { projectId_name: { projectId, name: dto.name } },
      });
      if (dup) {
        throw new ConflictException(`Component "${dto.name}" already exists`);
      }
    }

    return this.prisma.component.update({
      where: { id: componentId },
      data: dto,
      include: {
        lead: { select: USER_SELECT },
        defaultAssignee: { select: USER_SELECT },
        _count: { select: { issues: true } },
      },
    });
  }

  async remove(projectId: string, componentId: string) {
    const component = await this.prisma.component.findUnique({
      where: { id: componentId },
    });

    if (!component || component.projectId !== projectId) {
      throw new NotFoundException('Component not found');
    }

    await this.prisma.component.delete({ where: { id: componentId } });
    return { deleted: true };
  }
}
