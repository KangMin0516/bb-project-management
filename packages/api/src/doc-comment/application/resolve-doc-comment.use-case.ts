import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  nextResolveState,
  normalizeDisplayName,
} from '../domain/doc-comment.entity.js';
import {
  DOC_COMMENT_REPOSITORY,
  type DocCommentRepository,
} from './ports/doc-comment.repository.js';
import { toCommentView, type DocCommentView } from './doc-comment.view.js';

export interface ResolveDocCommentCommand {
  projectId: string;
  commentId: string;
  resolved: boolean;
  /** Display name to stamp on the resolve; anyone with the link may. */
  by: string | null;
  authorKey: string | null;
}

@Injectable()
export class ResolveDocCommentUseCase {
  constructor(
    @Inject(DOC_COMMENT_REPOSITORY)
    private readonly repo: DocCommentRepository,
  ) {}

  async execute(cmd: ResolveDocCommentCommand): Promise<DocCommentView> {
    const row = await this.repo.findAuthRow(cmd.commentId, cmd.projectId);
    // 404 rather than 403 for another project's id: the caller has no
    // business knowing the row exists.
    if (!row) throw new NotFoundException('Comment not found');
    if (row.parentId !== null)
      throw new BadRequestException(
        'Only the top comment of a thread can be resolved',
      );

    const next = nextResolveState(
      row,
      cmd.resolved,
      normalizeDisplayName(cmd.by),
      new Date(),
    );
    const updated = await this.repo.setResolved(
      row.id,
      next.resolvedAt,
      next.resolvedBy,
    );
    return toCommentView(updated, cmd.authorKey);
  }
}
