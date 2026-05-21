import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CreateShareLinkInput,
  ShareLinkRepository,
  ShareLinkRow,
  ShareLinkWithCreator,
  ShareScopeLiteral,
} from '../application/ports/share-link.repository.js';

@Injectable()
export class ShareLinkPrismaRepository implements ShareLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateShareLinkInput): Promise<ShareLinkRow> {
    const row = await this.prisma.shareLink.create({
      data: {
        token: input.token,
        passcodeHash: input.passcodeHash,
        scopes: input.scopes,
        expiresAt: input.expiresAt,
        projectId: input.projectId,
        createdById: input.createdById,
      },
    });
    return this.toRow(row);
  }

  async findByToken(token: string): Promise<ShareLinkRow | null> {
    const row = await this.prisma.shareLink.findUnique({ where: { token } });
    return row ? this.toRow(row) : null;
  }

  async findByIdScoped(
    id: string,
    projectId: string,
  ): Promise<ShareLinkRow | null> {
    const row = await this.prisma.shareLink.findFirst({
      where: { id, projectId },
    });
    return row ? this.toRow(row) : null;
  }

  async findByProject(projectId: string): Promise<ShareLinkWithCreator[]> {
    const rows = await this.prisma.shareLink.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
      },
    });
    return rows.map((r) => ({
      ...this.toRow(r),
      createdBy: r.createdBy,
    }));
  }

  async recordSuccess(id: string, now: Date): Promise<void> {
    await this.prisma.shareLink.update({
      where: { id },
      data: {
        lastAccessedAt: now,
        accessCount: { increment: 1 },
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async recordFailure(
    id: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.prisma.shareLink.update({
      where: { id },
      data: { failedAttempts, lockedUntil },
    });
  }

  async revoke(id: string, now: Date): Promise<ShareLinkRow> {
    const row = await this.prisma.shareLink.update({
      where: { id },
      data: { revokedAt: now },
    });
    return this.toRow(row);
  }

  async rotatePasscode(
    id: string,
    passcodeHash: string,
  ): Promise<ShareLinkRow> {
    const row = await this.prisma.shareLink.update({
      where: { id },
      data: {
        passcodeHash,
        // Rotating the passcode also clears any in-flight brute-force
        // lockout — otherwise an attacker who triggered the lockout
        // would block the legitimate PM from sharing the new code.
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    return this.toRow(row);
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.shareLink.delete({ where: { id } });
  }

  private toRow(row: {
    id: string;
    token: string;
    passcodeHash: string;
    scopes: ShareScopeLiteral[];
    expiresAt: Date | null;
    revokedAt: Date | null;
    lastAccessedAt: Date | null;
    accessCount: number;
    failedAttempts: number;
    lockedUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    createdById: string;
  }): ShareLinkRow {
    return row;
  }
}
