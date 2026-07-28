import { describe, expect, it } from '@jest/globals';
import {
  canDelete,
  canDeleteHeadWithReplies,
  canModerate,
  canSeeThread,
  type DocCommentCaller,
  type DocCommentRow,
  type ProjectRoleLiteral,
} from './doc-comment.entity.js';

function row(over: Partial<DocCommentRow> = {}): DocCommentRow {
  return {
    id: 'c-1',
    parentId: null,
    authorKey: null,
    userId: null,
    resolvedAt: null,
    resolvedBy: null,
    ...over,
  };
}

const guest = (authorKey: string | null): DocCommentCaller => ({
  authorKey,
  userId: null,
  role: null,
});
const member = (
  userId: string,
  authorKey: string | null = null,
  role: ProjectRoleLiteral = 'DEVELOPER',
): DocCommentCaller => ({ authorKey, userId, role });

const internalHead = { userId: 'u-7' };
const externalHead = { userId: null };

describe('canModerate', () => {
  it('is PM and ADMIN only', () => {
    expect(canModerate(member('u-1', null, 'ADMIN'))).toBe(true);
    expect(canModerate(member('u-1', null, 'PM'))).toBe(true);
    expect(canModerate(member('u-1', null, 'DEVELOPER'))).toBe(false);
    expect(canModerate(guest('k-1'))).toBe(false);
  });
});

describe('canSeeThread', () => {
  it('shows a guest the client-side threads and hides internal ones', () => {
    expect(canSeeThread(externalHead, guest('k-1'))).toBe(true);
    expect(canSeeThread(internalHead, guest('k-1'))).toBe(false);
  });

  it('shows a DEVELOPER internal threads and hides the client’s', () => {
    const dev = member('u-1', null, 'DEVELOPER');
    expect(canSeeThread(internalHead, dev)).toBe(true);
    expect(canSeeThread(externalHead, dev)).toBe(false);
  });

  it('shows PM and ADMIN both sides', () => {
    for (const role of ['PM', 'ADMIN'] as const) {
      const mod = member('u-1', null, role);
      expect(canSeeThread(internalHead, mod)).toBe(true);
      expect(canSeeThread(externalHead, mod)).toBe(true);
    }
  });

  it('keeps a thread visible to a member who posted in it', () => {
    // Role changed, or the thread predates the rule — either way their own
    // words must not vanish.
    const dev = member('u-1', null, 'DEVELOPER');
    expect(canSeeThread(externalHead, dev, ['u-2', 'u-1'])).toBe(true);
    expect(canSeeThread(externalHead, dev, ['u-2'])).toBe(false);
  });

  it('does not let a guest inherit visibility from participation', () => {
    // A guest's participation is keyed by browser, not account, and the
    // list of participants only carries user ids.
    expect(canSeeThread(internalHead, guest('k-1'), [null, null])).toBe(false);
  });
});

describe('canDelete', () => {
  it('lets a guest delete the row their browser key posted', () => {
    expect(canDelete(row({ authorKey: 'k-1' }), guest('k-1'))).toBe(true);
  });

  it('refuses another browser', () => {
    expect(canDelete(row({ authorKey: 'k-1' }), guest('k-2'))).toBe(false);
  });

  it('refuses a row with no key on file', () => {
    expect(canDelete(row(), guest('k-1'))).toBe(false);
  });

  it('lets a member delete their own comment from a different browser', () => {
    // No matching authorKey anywhere — the account is the only link.
    expect(canDelete(row({ userId: 'u-1' }), member('u-1'))).toBe(true);
  });

  it('refuses a second member sharing the same browser key', () => {
    // Both unlocked in this browser, so the key matches; identity must
    // still win, or one reviewer could delete the other's comment.
    expect(
      canDelete(row({ userId: 'u-1', authorKey: 'k-1' }), member('u-2', 'k-1')),
    ).toBe(false);
  });

  it('falls back to the browser key for a guest row read by a member', () => {
    // Commented before signing in, same browser.
    expect(canDelete(row({ authorKey: 'k-1' }), member('u-1', 'k-1'))).toBe(
      true,
    );
  });

  it('lets PM and ADMIN delete anything, including a row with no key', () => {
    for (const role of ['PM', 'ADMIN'] as const) {
      expect(canDelete(row({ authorKey: 'k-1' }), member('u-9', null, role))).toBe(
        true,
      );
      expect(canDelete(row({ userId: 'u-1' }), member('u-9', null, role))).toBe(
        true,
      );
      expect(canDelete(row(), member('u-9', null, role))).toBe(true);
    }
  });
});

describe('canDeleteHeadWithReplies', () => {
  it('allows deleting a thread the caller alone posted in', () => {
    const replies = [row({ id: 'r-1', authorKey: 'k-1', parentId: 'c-1' })];
    expect(canDeleteHeadWithReplies(replies, guest('k-1'))).toBe(true);
  });

  it('refuses once somebody else has replied', () => {
    const replies = [
      row({ id: 'r-1', authorKey: 'k-1', parentId: 'c-1' }),
      row({ id: 'r-2', authorKey: 'k-2', parentId: 'c-1' }),
    ];
    expect(canDeleteHeadWithReplies(replies, guest('k-1'))).toBe(false);
  });

  it('recognises the member’s own replies across browsers', () => {
    const replies = [row({ id: 'r-1', userId: 'u-1', parentId: 'c-1' })];
    expect(canDeleteHeadWithReplies(replies, member('u-1'))).toBe(true);
  });

  it('lets a moderator take a thread out with other people’s replies', () => {
    const replies = [
      row({ id: 'r-1', authorKey: 'k-1', parentId: 'c-1' }),
      row({ id: 'r-2', userId: 'u-2', parentId: 'c-1' }),
    ];
    expect(canDeleteHeadWithReplies(replies, member('u-9', null, 'PM'))).toBe(
      true,
    );
  });
});
