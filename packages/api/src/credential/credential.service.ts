import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CreateCredentialDto } from './dto/create-credential.dto.js';
import type { UpdateCredentialDto } from './dto/update-credential.dto.js';

export interface CredentialEntry {
  key: string;
  value: string;
  sensitive: boolean;
}

@Injectable()
export class CredentialService {
  constructor(private prisma: PrismaService) {}

  private parseEntries(raw: unknown): CredentialEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (e): e is CredentialEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.key === 'string' &&
        typeof e.value === 'string' &&
        typeof e.sensitive === 'boolean',
    );
  }

  private maskEntries(entries: CredentialEntry[]): CredentialEntry[] {
    return entries.map((entry) => ({
      ...entry,
      value: entry.sensitive ? '••••••••' : entry.value,
    }));
  }

  async findAll(projectId: string) {
    const credentials = await this.prisma.projectCredential.findMany({
      where: { projectId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((cred) => ({
      ...cred,
      entries: this.maskEntries(this.parseEntries(cred.entries)),
    }));
  }

  async findOne(projectId: string, id: string) {
    const credential = await this.prisma.projectCredential.findFirst({
      where: { id, projectId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return {
      ...credential,
      entries: this.maskEntries(this.parseEntries(credential.entries)),
    };
  }

  async reveal(projectId: string, id: string) {
    const credential = await this.prisma.projectCredential.findFirst({
      where: { id, projectId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return credential;
  }

  async create(projectId: string, userId: string, dto: CreateCredentialDto) {
    const credential = await this.prisma.projectCredential.create({
      data: {
        name: dto.name,
        serviceType: dto.serviceType,
        description: dto.description,
        url: dto.url,
        entries: dto.entries as unknown as Prisma.InputJsonValue,
        projectId,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return {
      ...credential,
      entries: this.maskEntries(this.parseEntries(credential.entries)),
    };
  }

  async update(projectId: string, id: string, dto: UpdateCredentialDto) {
    const existing = await this.prisma.projectCredential.findFirst({
      where: { id, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Credential not found');
    }

    const credential = await this.prisma.projectCredential.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.serviceType !== undefined && { serviceType: dto.serviceType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.entries !== undefined && {
          entries: dto.entries as unknown as Prisma.InputJsonValue,
        }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return {
      ...credential,
      entries: this.maskEntries(this.parseEntries(credential.entries)),
    };
  }

  async remove(projectId: string, id: string) {
    const existing = await this.prisma.projectCredential.findFirst({
      where: { id, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Credential not found');
    }

    await this.prisma.projectCredential.delete({ where: { id } });
    return { deleted: true };
  }
}
