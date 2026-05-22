import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_SELECT } from '../common/constants.js';

export type SearchResultKind = 'issue' | 'comment' | 'spec';

export interface SearchResult {
  kind: SearchResultKind;
  /** UUID of the matched row (issueId / commentId / specId). */
  id: string;
  projectId: string;
  projectKey: string;
  /** Display string — issue/spec title, or the comment's parent issue title. */
  title: string;
  snippet: string;
  /** Heuristic score (higher = better match). */
  score: number;
  /** For `issue` / `comment`: the parent issue's number. */
  issueNumber?: number;
}

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

  /**
   * Global cross-project search (PM-80). Merges hits from Issues
   * (title + description), Comments (content), and Specs (title +
   * content). Phase 1 uses `ILIKE` — no tsvector / GIN index yet,
   * acceptable for <10k rows per workspace. Phase 2 swaps in
   * Postgres full-text when row count justifies the migration cost.
   *
   * Scope: only projects the caller is a member of (workspace
   * superuser sees every project). No leak across tenants.
   */
  async searchAll(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperuser: true },
    });
    const isSuperuser = !!user?.isSuperuser;

    const projectScope = isSuperuser
      ? {}
      : { project: { members: { some: { userId } } } };

    const [issues, comments, specs] = await Promise.all([
      this.prisma.issue.findMany({
        where: {
          ...projectScope,
          archivedAt: null,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          number: true,
          projectId: true,
          project: { select: { key: true } },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.comment.findMany({
        where: {
          issue: { ...projectScope, archivedAt: null },
          content: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          content: true,
          issue: {
            select: {
              id: true,
              title: true,
              number: true,
              projectId: true,
              project: { select: { key: true } },
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.specification.findMany({
        where: {
          ...projectScope,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          projectId: true,
          project: { select: { key: true } },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const qLower = q.toLowerCase();
    const results: SearchResult[] = [
      ...issues.map((r) => {
        const titleHit = r.title.toLowerCase().includes(qLower);
        return {
          kind: 'issue' as const,
          id: r.id,
          projectId: r.projectId,
          projectKey: r.project?.key ?? '',
          title: r.title,
          issueNumber: r.number,
          snippet: snippet(r.description ?? '', q),
          score: titleHit ? 100 : 50,
        };
      }),
      ...comments.map((r) => ({
        kind: 'comment' as const,
        id: r.id,
        projectId: r.issue.projectId,
        projectKey: r.issue.project?.key ?? '',
        title: r.issue.title,
        issueNumber: r.issue.number,
        snippet: snippet(r.content, q),
        score: 30,
      })),
      ...specs.map((r) => {
        const titleHit = r.title.toLowerCase().includes(qLower);
        return {
          kind: 'spec' as const,
          id: r.id,
          projectId: r.projectId,
          projectKey: r.project?.key ?? '',
          title: r.title,
          snippet: snippet(r.content ?? '', q),
          score: titleHit ? 80 : 40,
        };
      }),
    ];

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

function snippet(text: string, query: string, max = 140): string {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, max);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}
