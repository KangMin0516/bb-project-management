import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(dto.password, 12);

    await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
    });

    return {
      message:
        '가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'PENDING') {
      throw new ForbiddenException('관리자 승인 대기 중입니다.');
    }

    if (user.status === 'REJECTED') {
      throw new ForbiddenException('가입이 거절되었습니다.');
    }

    return this.buildTokenResponse(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    // Refresh token format: "userId:uuid"
    const separatorIndex = refreshToken.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = refreshToken.substring(0, separatorIndex);
    const token = refreshToken.substring(separatorIndex + 1);

    const user = await this.prisma.user.findUnique({
      where: { id: userId, status: 'ACTIVE' },
      select: { id: true, email: true, refreshToken: true },
    });

    if (!user?.refreshToken || !(await compare(token, user.refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildTokenResponse(user.id, user.email);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    const valid = await compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, string> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSuperuser: true,
        createdAt: true,
      },
    });

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isSuperuser: true,
        createdAt: true,
      },
    });

    return user;
  }

  private async buildTokenResponse(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessToken = this.jwt.sign(payload);

    // Generate refresh token as "userId:uuid", store only the uuid hash
    const uuid = randomUUID();
    const refreshToken = `${userId}:${uuid}`;
    const refreshTokenHash = await hash(uuid, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email },
    };
  }
}
