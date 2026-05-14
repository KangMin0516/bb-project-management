import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { USER_SELECT } from '../../common/constants.js';
import { JoinRequest } from '../domain/join-request.entity.js';
import type {
  JoinRequestRepository,
  MyJoinRequestListItem,
  PendingForProjectListItem,
} from '../application/ports/join-request.repository.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prisma-backed JoinRequestRepository. Mapper sits inline (toRow /
 * toDomain) — the entity stays framework-free; only this file knows
 * about Prisma's row shape.
 */
@Injectable()
export class JoinRequestPrismaRepository implements JoinRequestRepository {
  constructor(private prisma: PrismaService) {}

  // ─── Aggregate root ───────────────────────────────────────

  async findById(id: string): Promise<JoinRequest | null> {
    const row = await this.prisma.projectJoinRequest.findUnique({
      where: { id },
    });
    return row ? toDomain(row) : null;
  }

  async findInProject(
    id: string,
    projectId: string,
  ): Promise<JoinRequest | null> {
    const row = await this.prisma.projectJoinRequest.findUnique({
      where: { id },
    });
    if (!row) return null;
    if (row.projectId !== projectId) return null;
    return toDomain(row);
  }

  async findActiveForRequester(
    requesterId: string,
    projectId: string,
  ): Promise<JoinRequest | null> {
    const row = await this.prisma.projectJoinRequest.findUnique({
      where: { requesterId_projectId: { requesterId, projectId } },
    });
    return row ? toDomain(row) : null;
  }

  async save(request: JoinRequest): Promise<void> {
    const row = toRow(request);
    await this.prisma.projectJoinRequest.upsert({
      where: { id: row.id },
      update: {
        status: row.status,
        rejectionReason: row.rejectionReason,
        resolvedById: row.resolvedById,
        resolvedAt: row.resolvedAt,
        message: row.message,
      },
      create: row,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.projectJoinRequest.delete({ where: { id } });
  }

  /**
   * Approve = atomic (a) request status → APPROVED (b) member upsert.
   * This is the legacy `$transaction` from JoinRequestService.approve.
   */
  async approveAndAddMember(request: JoinRequest): Promise<void> {
    const row = toRow(request);
    await this.prisma.$transaction([
      this.prisma.projectJoinRequest.update({
        where: { id: row.id, status: 'PENDING' },
        data: {
          status: row.status,
          resolvedById: row.resolvedById,
          resolvedAt: row.resolvedAt,
        },
      }),
      this.prisma.projectMember.upsert({
        where: {
          userId_projectId: {
            userId: row.requesterId,
            projectId: row.projectId,
          },
        },
        create: {
          userId: row.requesterId,
          projectId: row.projectId,
          role: 'DEVELOPER',
        },
        update: {},
      }),
    ]);
  }

  // ─── Cross-domain helpers ─────────────────────────────────

  async isMemberOfProject(userId: string, projectId: string): Promise<boolean> {
    const found = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { id: true },
    });
    return !!found;
  }

  async resolveProjectId(idOrKey: string): Promise<string | null> {
    if (UUID_RE.test(idOrKey)) {
      const found = await this.prisma.project.findUnique({
        where: { id: idOrKey },
        select: { id: true },
      });
      return found?.id ?? null;
    }
    const found = await this.prisma.project.findUnique({
      where: { key: idOrKey },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  async loadProjectMeta(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, key: true },
    });
  }

  async loadRequesterMeta(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
  }

  async listPendingForProject(
    projectId: string,
  ): Promise<PendingForProjectListItem[]> {
    const rows = await this.prisma.projectJoinRequest.findMany({
      where: { projectId, status: 'PENDING' },
      include: { requester: { select: USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      request: toDomain(row),
      requester: row.requester,
    }));
  }

  async listForRequester(
    requesterId: string,
  ): Promise<MyJoinRequestListItem[]> {
    const rows = await this.prisma.projectJoinRequest.findMany({
      where: { requesterId },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      request: toDomain(row),
      project: row.project,
    }));
  }

  async listAdminsAndPms(projectId: string) {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId, role: { in: ['ADMIN', 'PM'] } },
      include: { user: { select: { id: true, slackUserId: true } } },
    });
    return rows.map((m) => ({
      userId: m.user.id,
      slackUserId: m.user.slackUserId,
    }));
  }
}

// ─── Mappers ────────────────────────────────────────────────

interface PrismaJoinRequestRow {
  id: string;
  projectId: string;
  requesterId: string;
  message: string | null;
  status: string;
  rejectionReason: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

function toDomain(row: PrismaJoinRequestRow): JoinRequest {
  return JoinRequest.fromPersistence({
    id: row.id,
    projectId: row.projectId,
    requesterId: row.requesterId,
    message: row.message,
    status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    rejectionReason: row.rejectionReason,
    resolvedById: row.resolvedById,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  });
}

function toRow(entity: JoinRequest): {
  id: string;
  projectId: string;
  requesterId: string;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
} {
  const props = entity.toJSON();
  return {
    id: props.id,
    projectId: props.projectId,
    requesterId: props.requesterId,
    message: props.message,
    status: props.status,
    rejectionReason: props.rejectionReason,
    resolvedById: props.resolvedById,
    resolvedAt: props.resolvedAt,
  };
}
