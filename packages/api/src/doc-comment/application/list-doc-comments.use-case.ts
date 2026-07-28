import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  normalizeDocKey,
  type DocCommentCaller,
} from '../domain/doc-comment.entity.js';
import {
  DOC_COMMENT_REPOSITORY,
  type DocCommentCount,
  type DocCommentRepository,
} from './ports/doc-comment.repository.js';
import {
  toThreadViews,
  type DocCommentThreadView,
} from './doc-comment.view.js';
import { visibleRecords } from './visibility.js';

export interface ListDocCommentsQuery {
  projectId: string;
  docKey: string;
  /** Used only to compute `mine` on each row. */
  caller: DocCommentCaller;
}

export interface ListDocCommentsResult {
  docKey: string;
  threads: DocCommentThreadView[];
}

@Injectable()
export class ListDocCommentsUseCase {
  constructor(
    @Inject(DOC_COMMENT_REPOSITORY)
    private readonly repo: DocCommentRepository,
  ) {}

  async execute(query: ListDocCommentsQuery): Promise<ListDocCommentsResult> {
    const docKey = normalizeDocKey(query.docKey);
    if (!docKey.ok) throw new BadRequestException(docKey.failure.message);

    const rows = await this.repo.findByDoc(query.projectId, docKey.value);
    return {
      docKey: docKey.value,
      threads: toThreadViews(visibleRecords(rows, query.caller), query.caller),
    };
  }
}

/**
 * Ceiling on a project-wide read. High enough that no real review comes
 * near it, low enough that one request can't ask for an unbounded
 * payload. There is no cursor: the client polls this and wants a whole
 * picture, so the honest failure mode is "we told you it was cut" rather
 * than a half-set that reads as complete.
 */
export const MAX_PROJECT_COMMENTS = 1000;

export interface ListAllDocCommentsResult {
  threads: DocCommentThreadView[];
  truncated: boolean;
}

@Injectable()
export class ListAllDocCommentsUseCase {
  constructor(
    @Inject(DOC_COMMENT_REPOSITORY)
    private readonly repo: DocCommentRepository,
  ) {}

  /**
   * Every thread in the project. Cutting the tail of a
   * chronologically-ordered list can never orphan a reply — a head is
   * always older than its replies, so anything whose head fell outside
   * the cap fell outside it too.
   */
  async execute(query: {
    projectId: string;
    caller: DocCommentCaller;
  }): Promise<ListAllDocCommentsResult> {
    const rows = await this.repo.findByProject(
      query.projectId,
      MAX_PROJECT_COMMENTS,
    );
    // The cap applies before the visibility filter, so it counts what the
    // project holds rather than what this caller is allowed to read —
    // truncation is a property of the data, not of who is asking.
    const truncated = rows.length > MAX_PROJECT_COMMENTS;
    const kept = truncated ? rows.slice(0, MAX_PROJECT_COMMENTS) : rows;
    return {
      threads: toThreadViews(visibleRecords(kept, query.caller), query.caller),
      truncated,
    };
  }
}

@Injectable()
export class CountDocCommentsUseCase {
  constructor(
    @Inject(DOC_COMMENT_REPOSITORY)
    private readonly repo: DocCommentRepository,
  ) {}

  /**
   * Per-document tallies for the whole project, so a client can badge its
   * nav in one request instead of one per page.
   *
   * Counted from the same visibility-filtered set the list routes return,
   * not from a `GROUP BY` over the table: a badge reading "3" on a page
   * where the caller can open nothing would leak that an internal
   * conversation exists. Costs a row read instead of an aggregate, which
   * is affordable for a route nothing polls — the spec site now counts
   * from the list it already holds.
   */
  async execute(
    projectId: string,
    caller: DocCommentCaller,
  ): Promise<DocCommentCount[]> {
    const rows = await this.repo.findByProject(projectId, MAX_PROJECT_COMMENTS);
    const byDoc = new Map<string, DocCommentCount>();
    for (const row of visibleRecords(rows, caller)) {
      // Heads only: a reply belongs to its head's thread, so counting
      // replies would inflate every badge.
      if (row.parentId !== null) continue;
      const entry =
        byDoc.get(row.docKey) ?? { docKey: row.docKey, open: 0, resolved: 0 };
      if (row.resolvedAt === null) entry.open += 1;
      else entry.resolved += 1;
      byDoc.set(row.docKey, entry);
    }
    return [...byDoc.values()];
  }
}
