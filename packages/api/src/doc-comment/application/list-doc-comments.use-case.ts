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
      threads: toThreadViews(rows, query.caller),
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
   * Per-document tallies for the whole project, so the spec site can
   * badge its nav in one request instead of one per page.
   */
  execute(projectId: string): Promise<DocCommentCount[]> {
    return this.repo.countByProject(projectId);
  }
}
