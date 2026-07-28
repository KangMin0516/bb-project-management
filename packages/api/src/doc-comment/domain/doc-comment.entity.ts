/**
 * Domain layer for DocComment — pure functions over the persistence row
 * shape, no Prisma and no Nest. Use cases call these to decide whether
 * to proceed; the repository is the only thing that writes.
 *
 * The rules worth stating up front, because they are what make this
 * model different from `Comment` (issue-bound) and `SpecComment`
 * (member-only):
 *
 * - **Anchors are advisory.** A comment whose quote no longer exists in
 *   the document is *orphaned*, never deleted. Reviewers lose trust in
 *   a comment system the first time it eats a comment.
 * - **Threads are one level deep.** A head has no parent; replies point
 *   at a head and may not carry their own anchor.
 * - **Resolve is a property of the head.** Replies are not individually
 *   resolvable — the thread is the unit of "dealt with".
 * - **A guest's `authorKey` is their only credential.** It authorises
 *   exactly one row and is never echoed back to any client. A member who
 *   unlocked with a BB PM credential is identified by `userId` instead,
 *   which survives clearing the browser's storage.
 */

export const MAX_BODY_LENGTH = 4000;
export const MAX_QUOTE_LENGTH = 1000;
export const MAX_CONTEXT_LENGTH = 120;
export const MAX_DOC_KEY_LENGTH = 300;
export const MAX_CONTAINER_ID_LENGTH = 200;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_AUTHOR_KEY_LENGTH = 64;

export interface DocCommentAnchor {
  containerId: string | null;
  quote: string | null;
  prefix: string | null;
  suffix: string | null;
  textOffset: number | null;
}

export interface DocCommentRow {
  id: string;
  parentId: string | null;
  authorKey: string | null;
  userId: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

/** Mirrors Prisma's `ProjectRole`. A passcode guest has no role. */
export type ProjectRoleLiteral = 'ADMIN' | 'PM' | 'DEVELOPER';

/**
 * Who is asking. A passcode guest has only `authorKey`, the opaque id
 * their browser minted. A member unlocked with a BB PM credential and
 * carries `userId` plus their project role — re-read per request, so a
 * change in role or a revoked membership bites now instead of when their
 * token lapses.
 */
export interface DocCommentCaller {
  authorKey: string | null;
  userId: string | null;
  role: ProjectRoleLiteral | null;
}

/**
 * PM and ADMIN are the roles that talk to the client, so they are the
 * ones who see both sides of the review and can clear up whatever lands
 * in it. Everyone else answers only for their own comments.
 */
export function canModerate(caller: DocCommentCaller): boolean {
  return caller.role === 'ADMIN' || caller.role === 'PM';
}

/**
 * A thread is *internal* when a BB PM user started it and *external* when
 * a share-link guest did. That is the whole visibility axis:
 *
 * - A guest sees external threads. The team's internal notes are not for
 *   the client — a gap that only opened once members could sign in and
 *   comment as themselves, because before that every comment was a guest's.
 * - A DEVELOPER sees internal threads. The client's questions are the PM's
 *   conversation to run.
 * - PM / ADMIN see both.
 *
 * Classified by the **head**, never per comment: a thread is one
 * conversation, and hiding half would leave a reply dangling under a
 * question the reader can't see.
 *
 * `participantUserIds` is the one softening. A member who has posted in a
 * thread keeps seeing it whatever its head is — otherwise a role change,
 * or a thread predating this rule, makes somebody's own words vanish, and
 * a comment tool that eats your comment is worse than one that shows you
 * more than it strictly must.
 */
export function canSeeThread(
  head: { userId: string | null },
  caller: DocCommentCaller,
  participantUserIds: readonly (string | null)[] = [],
): boolean {
  if (canModerate(caller)) return true;
  const internal = head.userId !== null;
  if (caller.userId)
    return internal || participantUserIds.includes(caller.userId);
  return !internal;
}

export type ValidationFailure = { field: string; message: string };

/**
 * Trim and bound the comment text. Returns the value to persist, or a
 * failure the use case turns into a 400. Whitespace-only bodies are
 * rejected rather than silently stored — an empty bubble in the margin
 * is a bug report waiting to happen.
 */
export function normalizeBody(
  raw: string,
): { ok: true; value: string } | { ok: false; failure: ValidationFailure } {
  const value = raw.trim();
  if (!value)
    return {
      ok: false,
      failure: { field: 'body', message: 'Comment cannot be empty' },
    };
  if (value.length > MAX_BODY_LENGTH)
    return {
      ok: false,
      failure: {
        field: 'body',
        message: `Comment cannot exceed ${MAX_BODY_LENGTH} characters`,
      },
    };
  return { ok: true, value };
}

/**
 * The document address. We never dereference it, so the only rules are
 * the ones that keep it a usable grouping key: rooted, no query string
 * or fragment (those are view state, not identity — `/f/js-auth?tab=2`
 * and `/f/js-auth` are the same page), no trailing slash, bounded.
 */
export function normalizeDocKey(
  raw: string,
): { ok: true; value: string } | { ok: false; failure: ValidationFailure } {
  let value = raw.trim();
  const cut = value.search(/[?#]/);
  if (cut !== -1) value = value.slice(0, cut);
  if (value.length > 1) value = value.replace(/\/+$/, '');
  if (!value.startsWith('/'))
    return {
      ok: false,
      failure: { field: 'docKey', message: 'docKey must start with "/"' },
    };
  if (value.length > MAX_DOC_KEY_LENGTH)
    return {
      ok: false,
      failure: {
        field: 'docKey',
        message: `docKey cannot exceed ${MAX_DOC_KEY_LENGTH} characters`,
      },
    };
  return { ok: true, value };
}

/**
 * Clamp the anchor to what the columns hold. Over-long context is
 * truncated rather than rejected: the client picked the window, and a
 * shorter prefix/suffix only makes re-anchoring slightly less precise.
 * An over-long *quote* is also truncated — the leading characters are
 * what the matcher uses first.
 *
 * Replies pass `null` and inherit the head's anchor.
 */
export function normalizeAnchor(
  raw: Partial<DocCommentAnchor> | null | undefined,
): DocCommentAnchor {
  if (!raw)
    return {
      containerId: null,
      quote: null,
      prefix: null,
      suffix: null,
      textOffset: null,
    };
  const clamp = (v: string | null | undefined, max: number): string | null => {
    if (v == null) return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };
  return {
    containerId: clamp(raw.containerId, MAX_CONTAINER_ID_LENGTH),
    // Quote keeps its surrounding whitespace trimmed but inner runs
    // intact — the matcher compares against document text verbatim.
    quote: raw.quote?.length ? raw.quote.slice(0, MAX_QUOTE_LENGTH) : null,
    prefix: clamp(raw.prefix, MAX_CONTEXT_LENGTH),
    suffix: clamp(raw.suffix, MAX_CONTEXT_LENGTH),
    textOffset:
      typeof raw.textOffset === 'number' && Number.isFinite(raw.textOffset)
        ? Math.max(0, Math.trunc(raw.textOffset))
        : null,
  };
}

/**
 * A display name is optional — an unnamed guest shows as "Guest". We
 * store what they typed, bounded; we do not attempt to make it unique
 * or to stop two people picking the same name. This is a review tool
 * behind a passcode, not an identity provider.
 */
export function normalizeDisplayName(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export type ReplyTargetFailure =
  | { reason: 'NOT_FOUND' }
  | { reason: 'NOT_A_HEAD' };

/**
 * A reply may only attach to a thread head. Allowing replies-to-replies
 * would make the depth unbounded and the rail unreadable; Notion makes
 * the same call.
 */
export function checkReplyTarget(
  parent: DocCommentRow | null,
): { ok: true } | { ok: false; failure: ReplyTargetFailure } {
  if (!parent) return { ok: false, failure: { reason: 'NOT_FOUND' } };
  if (parent.parentId !== null)
    return { ok: false, failure: { reason: 'NOT_A_HEAD' } };
  return { ok: true };
}

/**
 * Who may delete a row.
 *
 * A moderator (PM / ADMIN) may delete anything — spam and comments filed
 * against the wrong feature need somebody able to clear them, and the
 * alternative is a hand-written DELETE against the database.
 *
 * Otherwise it is the row's own author, with two kinds of ownership
 * checked in this order:
 *
 * 1. **Account.** When both the row and the caller carry a `userId`, that
 *    is the answer — a member who signed in on a second machine still
 *    owns their comment, and a *different* member sharing the same
 *    browser (so, the same `authorKey`) does not.
 * 2. **Browser key.** Otherwise fall back to the guest's per-browser
 *    capability. A row with neither key on file cannot be deleted
 *    through the public surface at all.
 */
export function canDelete(
  row: DocCommentRow,
  caller: DocCommentCaller,
): boolean {
  if (canModerate(caller)) return true;
  if (caller.userId && row.userId) return row.userId === caller.userId;
  if (!row.authorKey || !caller.authorKey) return false;
  return row.authorKey === caller.authorKey;
}

/**
 * Deleting a head takes its replies with it (FK cascade), so we refuse
 * when somebody else has replied. The author can still delete a thread
 * that only they have posted in. Anyone may resolve instead — that is
 * the non-destructive way to close a thread.
 *
 * A moderator is exempt: taking a spam thread out includes the replies
 * it attracted, and `canDelete` already granted them the head.
 */
export function canDeleteHeadWithReplies(
  replies: DocCommentRow[],
  caller: DocCommentCaller,
): boolean {
  return replies.every((r) => canDelete(r, caller));
}

/**
 * Resolve/unresolve is intentionally open to anyone holding the link:
 * the point of the state is "the team is done with this", and the
 * person who can answer a question is rarely the person who asked it.
 * Idempotent — resolving a resolved thread keeps the original stamp so
 * we don't lose who closed it first.
 */
export function nextResolveState(
  row: DocCommentRow,
  resolved: boolean,
  by: string | null,
  now: Date,
): { resolvedAt: Date | null; resolvedBy: string | null } {
  if (!resolved) return { resolvedAt: null, resolvedBy: null };
  if (row.resolvedAt)
    return { resolvedAt: row.resolvedAt, resolvedBy: row.resolvedBy };
  return { resolvedAt: now, resolvedBy: by };
}
