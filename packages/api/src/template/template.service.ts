import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';
import type { CreateTemplateDto } from './dto/create-template.dto.js';
import type { UpdateTemplateDto } from './dto/update-template.dto.js';

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTemplateDto, creatorId: string) {
    return this.prisma.issueTemplate.create({
      data: { ...dto, creatorId },
      include: { creator: { select: USER_SELECT } },
    });
  }

  async findAll() {
    return this.prisma.issueTemplate.findMany({
      include: { creator: { select: USER_SELECT } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  private async findOwned(id: string, userId: string) {
    const template = await this.prisma.issueTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (template.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can modify this template');
    }
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto, userId: string) {
    await this.findOwned(id, userId);

    return this.prisma.issueTemplate.update({
      where: { id },
      data: dto,
      include: { creator: { select: USER_SELECT } },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);

    await this.prisma.issueTemplate.delete({ where: { id } });
    return { deleted: true };
  }
}
