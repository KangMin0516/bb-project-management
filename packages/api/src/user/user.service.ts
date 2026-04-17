import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT, ADMIN_USER_SELECT } from '../common/constants.js';
import type { UserWhereInput } from '../../generated/prisma/models.js';
import type {
  AdminUpdateUserDto,
  AdminResetPasswordDto,
} from './dto/admin-user.dto.js';

const userSelect = {
  ...USER_SELECT,
  createdAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: userSelect,
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: userSelect,
    });
  }

  async findPending() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string) {
    return this.changeStatus(id, 'ACTIVE');
  }

  async reject(id: string) {
    return this.changeStatus(id, 'REJECTED');
  }

  private async changeStatus(id: string, status: 'ACTIVE' | 'REJECTED') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'PENDING')
      throw new BadRequestException('User is not in pending status');

    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  // ─── Admin methods ───────────────────────────────────────

  async adminFindAll(status?: string, search?: string) {
    const where: UserWhereInput = {
      status: { not: 'DELETED' },
    };

    if (status && ['ACTIVE', 'PENDING', 'REJECTED'].includes(status)) {
      where.status = status as 'ACTIVE' | 'PENDING' | 'REJECTED';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: ADMIN_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminUpdate(
    id: string,
    currentUserId: string,
    dto: AdminUpdateUserDto,
  ) {
    const user = await this.findActiveUser(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('Email already in use');
    }

    if (dto.isSuperuser === false && id === currentUserId) {
      throw new BadRequestException(
        'Cannot remove your own superuser privilege',
      );
    }

    if (dto.isSuperuser === false && user.isSuperuser) {
      await this.ensureNotLastSuperuser();
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.isSuperuser !== undefined && { isSuperuser: dto.isSuperuser }),
      },
      select: ADMIN_USER_SELECT,
    });
  }

  async adminResetPassword(id: string, dto: AdminResetPasswordDto) {
    await this.findActiveUser(id);

    const passwordHash = await hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  async adminSuspend(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot suspend yourself');
    }

    const user = await this.findActiveUser(id);
    if (user.status !== 'ACTIVE')
      throw new BadRequestException('Only active users can be suspended');

    if (user.isSuperuser) {
      await this.ensureNotLastSuperuser();
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED' },
      select: ADMIN_USER_SELECT,
    });
  }

  async adminActivate(id: string) {
    const user = await this.findActiveUser(id);
    if (user.status === 'ACTIVE')
      throw new BadRequestException('User is already active');

    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: ADMIN_USER_SELECT,
    });
  }

  async adminDelete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete yourself');
    }

    const user = await this.findActiveUser(id);

    if (user.isSuperuser) {
      await this.ensureNotLastSuperuser();
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
      select: { id: true, status: true },
    });
  }

  private async findActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === 'DELETED')
      throw new NotFoundException('User not found');
    return user;
  }

  private async ensureNotLastSuperuser() {
    const superuserCount = await this.prisma.user.count({
      where: { isSuperuser: true, status: { not: 'DELETED' } },
    });
    if (superuserCount <= 1) {
      throw new BadRequestException('Cannot modify the last superuser');
    }
  }
}
