import {
  canSeeThread,
  type DocCommentCaller,
} from '../domain/doc-comment.entity.js';
import type {
  DocCommentAuthRow,
  DocCommentRecord,
} from './ports/doc-comment.repository.js';

/**
 * Applies the thread-visibility rule from the domain to whole result
 * sets. Every read goes through here, so "what may this caller see" has
 * exactly one answer no matter which route asked.
 *
 * Filtering happens in the application layer rather than in SQL because
 * the rule is about a *thread* — its head's author, plus who has posted
 * in it — and expressing that as a WHERE clause would mean a correlated
 * subquery per row for a set already capped at a thousand.
 */

/** Head id for any row: a head is its own thread. */
const threadOf = (row: { id: string; parentId: string | null }) =>
  row.parentId ?? row.id;

const authorOf = (row: DocCommentRecord) => row.author.user?.id ?? null;

/**
 * Drop every row belonging to a thread this caller may not see. Replies
 * whose head is absent are dropped too — the same call `toThreadViews`
 * makes, since a reply with no question above it reads as nonsense.
 */
export function visibleRecords(
  rows: readonly DocCommentRecord[],
  caller: DocCommentCaller,
): DocCommentRecord[] {
  const heads = new Map<string, DocCommentRecord>();
  const participants = new Map<string, (string | null)[]>();

  for (const row of rows) {
    const thread = threadOf(row);
    if (row.parentId === null) heads.set(thread, row);
    const seen = participants.get(thread) ?? [];
    seen.push(authorOf(row));
    participants.set(thread, seen);
  }

  const allowed = new Set<string>();
  for (const [thread, head] of heads) {
    const visible = canSeeThread(
      { userId: authorOf(head) },
      caller,
      participants.get(thread) ?? [],
    );
    if (visible) allowed.add(thread);
  }

  return rows.filter((row) => allowed.has(threadOf(row)));
}

/**
 * The same question for a single thread, used by the write paths so a
 * caller can't reply to, resolve, or delete something they were never
 * allowed to read. The reply list is loaded lazily: it only matters when
 * the head alone doesn't already grant access, which is the rare case.
 */
export async function threadVisibleTo(
  head: DocCommentAuthRow,
  caller: DocCommentCaller,
  loadReplies: () => Promise<DocCommentAuthRow[]>,
): Promise<boolean> {
  if (canSeeThread(head, caller)) return true;
  if (!caller.userId) return false;
  const replies = await loadReplies();
  return canSeeThread(
    head,
    caller,
    replies.map((r) => r.userId),
  );
}
