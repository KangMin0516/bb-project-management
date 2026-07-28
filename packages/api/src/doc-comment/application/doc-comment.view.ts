import {
  canDelete,
  type DocCommentCaller,
} from '../domain/doc-comment.entity.js';
import type { DocCommentRecord } from './ports/doc-comment.repository.js';

/**
 * What a client is allowed to see. Built from `DocCommentRecord` by
 * dropping `authorKey` — the guest's bearer capability for that row —
 * and replacing it with a boolean the caller can act on.
 *
 * Keeping this mapping in one function is the only thing standing
 * between "delete your own comment" and "delete anyone's comment", so
 * every route returns views, never records.
 */
export interface DocCommentView {
  id: string;
  docKey: string;
  body: string;
  anchor: {
    containerId: string | null;
    quote: string | null;
    prefix: string | null;
    suffix: string | null;
    textOffset: number | null;
  };
  author: { name: string; avatar: string | null; isGuest: boolean };
  /** True when the caller wrote this row. Drives "your comment" affordances. */
  mine: boolean;
  /**
   * Whether the delete button should exist at all — own row, or a
   * moderator's licence over anyone's. Sent as a flag rather than left to
   * the client to infer, so the UI can't offer an action the use case
   * would then refuse.
   */
  canDelete: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocCommentThreadView extends DocCommentView {
  replies: DocCommentView[];
}

/**
 * Mirrors `canDelete` in the domain deliberately: `mine` is what draws
 * the delete button, and a UI that offers an action the use case then
 * refuses is worse than no button at all. Account ownership wins over
 * the browser key for the same reason it does there.
 */
function isMine(row: DocCommentRecord, caller: DocCommentCaller): boolean {
  if (caller.userId && row.author.user)
    return row.author.user.id === caller.userId;
  return Boolean(
    caller.authorKey && row.authorKey && row.authorKey === caller.authorKey,
  );
}

function toView(
  row: DocCommentRecord,
  caller: DocCommentCaller,
): DocCommentView {
  return {
    id: row.id,
    docKey: row.docKey,
    body: row.body,
    anchor: {
      containerId: row.containerId,
      quote: row.quote,
      prefix: row.prefix,
      suffix: row.suffix,
      textOffset: row.textOffset,
    },
    author: {
      name: row.author.user?.name ?? row.author.guestName ?? 'Guest',
      avatar: row.author.user?.avatar ?? null,
      isGuest: row.author.user === null,
    },
    mine: isMine(row, caller),
    canDelete: canDelete(
      {
        id: row.id,
        parentId: row.parentId,
        authorKey: row.authorKey,
        userId: row.author.user?.id ?? null,
        resolvedAt: row.resolvedAt,
        resolvedBy: row.resolvedBy,
      },
      caller,
    ),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCommentView(
  row: DocCommentRecord,
  caller: DocCommentCaller,
): DocCommentView {
  return toView(row, caller);
}

/**
 * Fold a flat, chronologically-ordered row list into threads. Replies
 * whose head is missing (deleted mid-poll) are dropped rather than
 * promoted to heads — a reply with no question above it reads as
 * nonsense in the rail.
 */
export function toThreadViews(
  rows: DocCommentRecord[],
  caller: DocCommentCaller,
): DocCommentThreadView[] {
  const threads = new Map<string, DocCommentThreadView>();
  for (const row of rows) {
    if (row.parentId === null)
      threads.set(row.id, { ...toView(row, caller), replies: [] });
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    threads.get(row.parentId)?.replies.push(toView(row, caller));
  }
  return [...threads.values()];
}
