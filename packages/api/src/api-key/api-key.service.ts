import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateApiKeyDto } from './dto/create-api-key.dto.js';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateApiKeyDto) {
    const rawKey = `bbpm_${randomBytes(28).toString('hex')}`;
    const hashedKey = await bcrypt.hash(rawKey, 10);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        key: hashedKey,
        name: dto.name,
        userId,
      },
    });

    // Return raw key only on creation (never exposed again)
    return { id: apiKey.id, name: apiKey.name, key: rawKey, createdAt: apiKey.createdAt };
  }

  async findAll(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        key: false,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.userId !== userId) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id: keyId } });
    return { deleted: true };
  }

  async validateKey(rawKey: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      include: { user: { select: { id: true, email: true, isSuperuser: true } } },
    });

    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(rawKey, apiKey.key);
      if (isMatch) {
        // Update lastUsed
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsed: new Date() },
        });
        return apiKey.user;
      }
    }

    return null;
  }
}
