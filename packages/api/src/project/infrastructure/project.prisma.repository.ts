import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Project } from '../domain/project.entity.js';
import type {
  ArchivedProjectView,
  DefaultLabelSeed,
  ProjectRepository,
  ProjectWithCounts,
  ProjectWithDetails,
  ProjectWithMembership,
  ProjectWithMembersAndCount,
} from '../application/ports/project.repository.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MEMBER_INCLUDE = {
  include: {
    user: {
      select: { id: true, email: true, name: true, avatar: true },
    },
  },
} as const;

@Injectable()
export class ProjectPrismaRepository implements ProjectRepository {
  constructor(private prisma: PrismaService) {}

  // ─── Aggregate ops ─────────────────────────────────────────

  async findById(id: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByKey(key: string): Promise<Project | null> {
    const row = await this.prisma.project.findUnique({ where: { key } });
    return row ? toDomain(row) : null;
  }

  async save(project: Project): Promise<void> {
    const props = project.toJSON();
    await this.prisma.project.update({
      where: { id: props.id },
      data: {
        name: props.name,
        description: props.description,
        archivedAt: props.archivedAt,
        archivedById: props.archivedById,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }

  /**
   * Project + initial members + default labels — all in a single
   * `$transaction`. Fixes P7 from the behavior checklist (legacy
   * service created the project and then ran `label.createMany`
   * outside any transaction, leaving an orphaned zero-label project
   * on a partial failure).
   */
  async createAtomic(
    project: Project,
    memberUserIds: string[],
    defaultLabels: DefaultLabelSeed[],
  ): Promise<ProjectWithMembersAndCount> {
    const props = project.toJSON();
    const [created] = await this.prisma.$transaction([
      this.prisma.project.create({
        data: {
          id: props.id,
          name: props.name,
          key: props.key,
          description: props.description,
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
          members: {
            create: memberUserIds.map((userId) => ({ userId, role: 'ADMIN' })),
          },
        },
        include: {
          members: MEMBER_INCLUDE,
          _count: { select: { issues: true } },
        },
      }),
      this.prisma.label.createMany({
        data: defaultLabels.map((label) => ({ ...label, projectId: props.id })),
        skipDuplicates: true,
      }),
    ]);
    return created as ProjectWithMembersAndCount;
  }

  // ─── Read views ─────────────────────────────────────────────

  async listForUser(userId: string): Promise<ProjectWithCounts[]> {
    return this.prisma.project.findMany({
      where: {
        members: { some: { userId } },
        archivedAt: null,
      },
      include: { _count: { select: { issues: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllWithMembership(
    userId: string,
  ): Promise<ProjectWithMembership[]> {
    const rows = await this.prisma.project.findMany({
      where: { archivedAt: null },
      include: {
        _count: { select: { issues: true, members: true } },
        members: {
          where: { userId },
          select: { id: true, role: true },
          take: 1,
        },
        joinRequests: {
          where: { requesterId: userId, status: 'PENDING' },
          select: { id: true, status: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      _count: p._count,
      isMember: p.members.length > 0,
      myRole: p.members[0]?.role ?? null,
      pendingJoinRequest: p.joinRequests[0] ?? null,
    }));
  }

  async findWithDetails(
    idOrKey: string,
    opts?: { includeArchived?: boolean },
  ): Promise<ProjectWithDetails | null> {
    const base = UUID_RE.test(idOrKey) ? { id: idOrKey } : { key: idOrKey };
    const row = await this.prisma.project.findUnique({
      where: base,
      include: {
        members: MEMBER_INCLUDE,
        labels: true,
        _count: { select: { issues: true } },
      },
    });
    if (!row) return null;
    if (row.archivedAt !== null && !opts?.includeArchived) return null;
    return row;
  }

  async listArchived(): Promise<ArchivedProjectView[]> {
    // Two queries instead of `include: { issues }` so we don't materialise
    // every DONE Issue row just to count it (a long-lived project
    // archived with 5k DONE issues would otherwise pull 5k ids).
    // Both counts exclude soft-deleted issues (Issue.archivedAt) so the
    // tab reflects what would be visible if the project were unarchived,
    // not the lifetime issue count.
    const rows = await this.prisma.project.findMany({
      where: { archivedAt: { not: null } },
      include: {
        archivedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { issues: { where: { archivedAt: null } } } },
      },
      orderBy: { archivedAt: 'desc' },
    });
    const projectIds = rows.map((r) => r.id);
    const doneByProject = projectIds.length
      ? await this.prisma.issue.groupBy({
          by: ['projectId'],
          where: {
            projectId: { in: projectIds },
            status: 'DONE',
            archivedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const doneMap = new Map(
      doneByProject.map((r) => [r.projectId, r._count._all]),
    );
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      // archivedAt is guaranteed non-null by the where filter, but the
      // generated type is still Date|null — assert here.
      archivedAt: p.archivedAt as Date,
      archivedBy: p.archivedBy,
      issueCount: {
        total: p._count.issues,
        done: doneMap.get(p.id) ?? 0,
      },
    }));
  }

  async loadUpdateView(id: string): Promise<ProjectWithMembersAndCount | null> {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        members: MEMBER_INCLUDE,
        _count: { select: { issues: true } },
      },
    });
  }

  // ─── Cross-domain helpers ───────────────────────────────────

  async listActiveSuperuserIds(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { isSuperuser: true, status: 'ACTIVE' },
      select: { id: true },
    });
    return rows.map((u) => u.id);
  }
}

// ─── Mapper ─────────────────────────────────────────────────

interface PrismaProjectRow {
  id: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: Date | null;
  archivedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: PrismaProjectRow): Project {
  return Project.fromPersistence({
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    archivedAt: row.archivedAt,
    archivedById: row.archivedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
