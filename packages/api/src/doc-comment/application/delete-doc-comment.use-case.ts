import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canDelete,
  canDeleteHeadWithReplies,
  type DocCommentCaller,
} from '../domain/doc-comment.entity.js';
import {
  DOC_COMMENT_REPOSITORY,
  type DocCommentRepository,
} from './ports/doc-comment.repository.js';

export interface DeleteDocCommentCommand {
  projectId: string;
  commentId: string;
  caller: DocCommentCaller;
}

@Injectable()
export class DeleteDocCommentUseCase {
  constructor(
    @Inject(DOC_COMMENT_REPOSITORY)
    private readonly repo: DocCommentRepository,
  ) {}

  async execute(cmd: DeleteDocCommentCommand): Promise<{ id: string }> {
    const row = await this.repo.findAuthRow(cmd.commentId, cmd.projectId);
    if (!row) throw new NotFoundException('Comment not found');

    if (!canDelete(row, cmd.caller))
      throw new ForbiddenException('You can only delete your own comment');

    if (row.parentId === null) {
      // Deleting a head cascades to its replies, so refuse when anyone
      // else has answered. Resolve is the non-destructive close.
      const replies = await this.repo.findReplies(row.id);
      if (!canDeleteHeadWithReplies(replies, cmd.caller))
        throw new ConflictException(
          'This thread has replies from other people — resolve it instead of deleting',
        );
    }

    await this.repo.delete(row.id);
    return { id: row.id };
  }
}
