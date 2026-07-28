import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CreateDocCommentInput,
  DocCommentAuthRow,
  DocCommentCount,
  DocCommentRecord,
  DocCommentRepository,
} from '../application/ports/doc-comment.repository.js';

/** Shape returned by every query below that maps to a full record. */
const RECORD_SELECT = {
  id: true,
  docKey: true,
  containerId: true,
  quote: true,
  prefix: true,
  suffix: true,
  textOffset: true,
  body: true,
  parentId: true,
  authorKey: true,
  resolvedAt: true,
  resolvedBy: true,
  createdAt: true,
  updatedAt: true,
  guestName: true,
  user: { select: { id: true, name: true, avatar: true } },
} as const;

const AUTH_SELECT = {
  id: true,
  projectId: true,
  docKey: true,
  parentId: true,
  authorKey: true,
  resolvedAt: true,
  resolvedBy: true,
} as const;

interface RawRecord {
  id: string;
  docKey: string;
  containerId: string | null;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  textOffset: number | null;
  body: string;
  parentId: string | null;
  authorKey: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  guestName: string | null;
  user: { id: string; name: string; avatar: string | null } | null;
}

@Injectable()
export class DocCommentPrismaRepository implements DocCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDoc(
    projectId: string,
    docKey: string,
  ): Promise<DocCommentRecord[]> {
    const rows = await this.prisma.docComment.findMany({
      where: { projectId, docKey },
      orderBy: { createdAt: 'asc' },
      select: RECORD_SELECT,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async countByProject(projectId: string): Promise<DocCommentCount[]> {
    // Heads only — a reply is part of its head's thread, not a thread of
    // its own, so counting replies would inflate every badge.
    const rows = await this.prisma.docComment.groupBy({
      by: ['docKey', 'resolvedAt'],
      where: { projectId, parentId: null },
      _count: { _all: true },
    });

    const byDoc = new Map<string, DocCommentCount>();
    for (const row of rows) {
      const entry = byDoc.get(row.docKey) ?? {
        docKey: row.docKey,
        open: 0,
        resolved: 0,
      };
      // groupBy on a nullable timestamp yields one bucket per distinct
      // value, so fold every non-null stamp into "resolved".
      if (row.resolvedAt === null) entry.open += row._count._all;
      else entry.resolved += row._count._all;
      byDoc.set(row.docKey, entry);
    }
    return [...byDoc.values()];
  }

  async create(input: CreateDocCommentInput): Promise<DocCommentRecord> {
    const row = await this.prisma.docComment.create({
      data: {
        projectId: input.projectId,
        docKey: input.docKey,
        containerId: input.containerId,
        quote: input.quote,
        prefix: input.prefix,
        suffix: input.suffix,
        textOffset: input.textOffset,
        body: input.body,
        parentId: input.parentId,
        guestName: input.guestName,
        authorKey: input.authorKey,
        shareLinkId: input.shareLinkId,
      },
      select: RECORD_SELECT,
    });
    return this.toRecord(row);
  }

  async findAuthRow(
    id: string,
    projectId: string,
  ): Promise<DocCommentAuthRow | null> {
    return this.prisma.docComment.findFirst({
      where: { id, projectId },
      select: AUTH_SELECT,
    });
  }

  async findReplies(parentId: string): Promise<DocCommentAuthRow[]> {
    return this.prisma.docComment.findMany({
      where: { parentId },
      select: AUTH_SELECT,
    });
  }

  async setResolved(
    id: string,
    resolvedAt: Date | null,
    resolvedBy: string | null,
  ): Promise<DocCommentRecord> {
    const row = await this.prisma.docComment.update({
      where: { id },
      data: { resolvedAt, resolvedBy },
      select: RECORD_SELECT,
    });
    return this.toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.docComment.delete({ where: { id } });
  }

  private toRecord(row: RawRecord): DocCommentRecord {
    const { guestName, user, ...rest } = row;
    return { ...rest, author: { user, guestName } };
  }
}
