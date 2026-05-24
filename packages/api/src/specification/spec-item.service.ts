import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { parseCheckboxes } from './lib/markdown-checkbox-parser.js';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

interface HeadingPosition {
  lineNumber: number;
  slug: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+)/;

/**
 * Parse a spec's markdown content to find each `## Heading` line's slug.
 * Mirrors `SpecificationService.parseSections` to stay consistent on the
 * (title → slug) algorithm so SpecItem ↔ SpecSection mapping joins
 * correctly via `(specId, sectionId)`.
 */
function indexHeadings(content: string): HeadingPosition[] {
  const headings: HeadingPosition[] = [];
  const slugCounts = new Map<string, number>();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(HEADING_RE);
    if (!match) continue;
    const title = match[2].trim();
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 100);
    if (!baseSlug) continue;
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const slug = count > 0 ? `${baseSlug}-${count}` : baseSlug;
    headings.push({ lineNumber: i, slug });
  }
  return headings;
}

@Injectable()
export class SpecItemService {
  constructor(private prisma: PrismaService) {}

  /**
   * Idempotent parse → upsert pipeline for one Specification.
   *
   * Reads `content`, extracts every `- [ ]` line as a SpecItem keyed by its
   * `<!-- spec-item:<uuid> -->` marker, then:
   *   - upserts every marker present in the content (new ones inserted,
   *     existing ones updated to the latest text/order/section),
   *   - archives every previously-active marker that disappeared from the
   *     content (soft-delete via `archivedAt`, issue links preserved),
   *   - un-archives any marker that the PM restored by pasting the comment
   *     back.
   *
   * Returns the rewritten markdown so the caller can persist it to
   * `Specification.content` — this is what makes the parse idempotent.
   * Section sync (`syncSections`) MUST run before this so the new SpecSection
   * rows exist when we resolve item.sectionId.
   */
  async upsertFromContent(
    tx: TxClient,
    specId: string,
    content: string,
  ): Promise<{ markedContent: string }> {
    const { markedContent, items } = parseCheckboxes(content);

    const sections = await tx.specSection.findMany({
      where: { specId },
      select: { id: true, sectionId: true },
    });
    const sectionDbIdBySlug = new Map(sections.map((s) => [s.sectionId, s.id]));

    const headings = indexHeadings(content);
    const findSectionDbIdForLine = (lineNumber: number): string | null => {
      let resolved: string | null = null;
      for (const h of headings) {
        if (h.lineNumber < lineNumber) {
          resolved = sectionDbIdBySlug.get(h.slug) ?? null;
        } else {
          break;
        }
      }
      return resolved;
    };

    const seenMarkers = new Set<string>();
    for (const item of items) {
      seenMarkers.add(item.marker);
      const sectionDbId = findSectionDbIdForLine(item.lineNumber);
      await tx.specItem.upsert({
        where: { specId_marker: { specId, marker: item.marker } },
        create: {
          specId,
          marker: item.marker,
          text: item.text,
          order: item.order,
          sectionId: sectionDbId,
        },
        update: {
          text: item.text,
          order: item.order,
          sectionId: sectionDbId,
          archivedAt: null,
        },
      });
    }

    await tx.specItem.updateMany({
      where: {
        specId,
        archivedAt: null,
        ...(seenMarkers.size > 0 ? { marker: { notIn: [...seenMarkers] } } : {}),
      },
      data: { archivedAt: new Date() },
    });

    return { markedContent };
  }

  /**
   * Return every SpecItem for a spec with its linked issue summaries.
   * Default excludes archived rows; `includeArchived` opt-in for the
   * "archived items (N)" disclosure UI.
   */
  async findBySpec(
    specId: string,
    opts: { includeArchived?: boolean } = {},
  ) {
    return this.prisma.specItem.findMany({
      where: {
        specId,
        ...(opts.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ order: 'asc' }],
      include: {
        issueLinks: {
          include: {
            issue: {
              select: {
                id: true,
                number: true,
                title: true,
                status: true,
                priority: true,
                assigneeId: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
}
