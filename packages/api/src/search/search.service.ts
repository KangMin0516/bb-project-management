import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchIssues(userId: string, query: string) {
    return this.prisma.issue.findMany({
      where: {
        project: { members: { some: { userId } } },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        assignee: { select: USER_SELECT },
        project: { select: { id: true, key: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }
}
