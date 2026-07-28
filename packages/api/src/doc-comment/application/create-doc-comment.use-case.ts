import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  checkReplyTarget,
  normalizeAnchor,
  normalizeBody,
  normalizeDisplayName,
  normalizeDocKey,
  type DocCommentAnchor,
  type ProjectRoleLiteral,
} from '../domain/doc-comment.entity.js';
import { threadVisibleTo } from './visibility.js';
import {
  DOC_COMMENT_REPOSITORY,
  type DocCommentRepository,
} from './ports/doc-comment.repository.js';
import { toCommentView, type DocCommentView } from './doc-comment.view.js';

export interface CreateDocCommentCommand {
  projectId: string;
  shareLinkId: string | null;
  docKey: string;
  body: string;
  /** Null for a page-level comment; ignored entirely for replies. */
  anchor: Partial<DocCommentAnchor> | null;
  /** Set to reply to an existing thread head. */
  parentId: string | null;
  /** Member session: the comment is signed with this BB PM account. */
  userId: string | null;
  /** Project role behind that account; null for a passcode guest. */
  role: ProjectRoleLiteral | null;
  guestName: string | null;
  authorKey: string | null;
}

@Injectable()
export class CreateDocCommentUseCase {
  constructor(
    @Inject(DOC_COMMENT_REPOSITORY)
    private readonly repo: DocCommentRepository,
  ) {}

  async execute(cmd: CreateDocCommentCommand): Promise<DocCommentView> {
    const body = normalizeBody(cmd.body);
    if (!body.ok) throw new BadRequestException(body.failure.message);

    const docKey = normalizeDocKey(cmd.docKey);
    if (!docKey.ok) throw new BadRequestException(docKey.failure.message);

    let parentId: string | null = null;
    let effectiveDocKey = docKey.value;
    let anchor: DocCommentAnchor = normalizeAnchor(cmd.anchor);

    if (cmd.parentId) {
      const parent = await this.repo.findAuthRow(cmd.parentId, cmd.projectId);
      const check = checkReplyTarget(parent);
      if (!check.ok) {
        if (check.failure.reason === 'NOT_FOUND')
          throw new NotFoundException('That comment thread no longer exists');
        throw new BadRequestException(
          'Replies must attach to the top comment of a thread',
        );
      }
      // You may only answer a question you were allowed to read. Same 404
      // as a missing thread on purpose — a distinct 403 would confirm that
      // the id belongs to a conversation the caller can't see.
      const caller = {
        authorKey: cmd.authorKey,
        userId: cmd.userId,
        role: cmd.role,
      };
      const visible = await threadVisibleTo(parent!, caller, () =>
        this.repo.findReplies(parent!.id),
      );
      if (!visible)
        throw new NotFoundException('That comment thread no longer exists');
      parentId = parent!.id;
      // The head owns both the document and the anchor. Trusting the
      // client's docKey here would let a reply drift onto another page
      // and vanish from the thread it belongs to.
      effectiveDocKey = parent!.docKey;
      anchor = normalizeAnchor(null);
    }

    const row = await this.repo.create({
      projectId: cmd.projectId,
      docKey: effectiveDocKey,
      containerId: anchor.containerId,
      quote: anchor.quote,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      textOffset: anchor.textOffset,
      body: body.value,
      parentId,
      userId: cmd.userId,
      // A member's name comes off their user row, so a `guestName` sent
      // alongside a member session is dropped rather than stored — it
      // would be a second, editable name for the same author.
      guestName: cmd.userId ? null : normalizeDisplayName(cmd.guestName),
      authorKey: cmd.authorKey,
      shareLinkId: cmd.shareLinkId,
    });

    return toCommentView(row, {
      authorKey: cmd.authorKey,
      userId: cmd.userId,
      role: cmd.role,
    });
  }
}
