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
  /** True when the caller's author key matches — enables their delete UI. */
  mine: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocCommentThreadView extends DocCommentView {
  replies: DocCommentView[];
}

function toView(
  row: DocCommentRecord,
  callerKey: string | null,
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
    mine: Boolean(callerKey && row.authorKey && row.authorKey === callerKey),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCommentView(
  row: DocCommentRecord,
  callerKey: string | null,
): DocCommentView {
  return toView(row, callerKey);
}

/**
 * Fold a flat, chronologically-ordered row list into threads. Replies
 * whose head is missing (deleted mid-poll) are dropped rather than
 * promoted to heads — a reply with no question above it reads as
 * nonsense in the rail.
 */
export function toThreadViews(
  rows: DocCommentRecord[],
  callerKey: string | null,
): DocCommentThreadView[] {
  const threads = new Map<string, DocCommentThreadView>();
  for (const row of rows) {
    if (row.parentId === null)
      threads.set(row.id, { ...toView(row, callerKey), replies: [] });
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    threads.get(row.parentId)?.replies.push(toView(row, callerKey));
  }
  return [...threads.values()];
}
