import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  createdAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : undefined,
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: userSelect,
    });
  }
}
