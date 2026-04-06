import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async findByIssue(issueId: string, page = 1, limit = 30) {
    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { issueId },
        include: {
          user: { select: { id: true, email: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activity.count({ where: { issueId } }),
    ]);

    return { items, total, page, limit };
  }

  async findByProject(projectId: string, page = 1, limit = 50) {
    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { issue: { projectId } },
        include: {
          user: { select: { id: true, email: true, name: true, avatar: true } },
          issue: { select: { id: true, number: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activity.count({ where: { issue: { projectId } } }),
    ]);

    return { items, total, page, limit };
  }
}
