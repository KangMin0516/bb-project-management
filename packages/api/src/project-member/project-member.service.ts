import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddMemberDto } from './dto/add-member.dto.js';
import type { UpdateMemberDto } from './dto/update-member.dto.js';

@Injectable()
export class ProjectMemberService {
  constructor(private prisma: PrismaService) {}

  async addMember(projectId: string, dto: AddMemberDto) {
    const existing = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: dto.userId, projectId } },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role,
      },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(projectId: string, memberId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.projectId !== projectId) {
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });
  }

  async removeMember(projectId: string, memberId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.projectId !== projectId) {
      throw new NotFoundException('Member not found in this project');
    }

    await this.prisma.projectMember.delete({ where: { id: memberId } });
    return { deleted: true };
  }
}
