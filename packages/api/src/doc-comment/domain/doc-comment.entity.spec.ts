import { describe, expect, it } from '@jest/globals';
import {
  canDelete,
  canDeleteHeadWithReplies,
  type DocCommentCaller,
  type DocCommentRow,
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
});
const member = (
  userId: string,
  authorKey: string | null = null,
): DocCommentCaller => ({ authorKey, userId });

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
});
