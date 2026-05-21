import {
  canUnlock,
  recordFailure,
  type ShareLinkRow,
} from './share-link.entity.js';

const base: ShareLinkRow = {
  failedAttempts: 0,
  lockedUntil: null,
  expiresAt: null,
  revokedAt: null,
};

const NOW = new Date('2026-05-21T10:00:00Z');

describe('canUnlock', () => {
  it('accepts a fresh link', () => {
    expect(canUnlock(base, NOW)).toEqual({ ok: true });
  });

  it('rejects a revoked link as REVOKED (revoke beats expiry beats lockout)', () => {
    const link: ShareLinkRow = {
      ...base,
      revokedAt: new Date(NOW.getTime() - 1000),
      expiresAt: new Date(NOW.getTime() - 1000),
      lockedUntil: new Date(NOW.getTime() + 60_000),
    };
    expect(canUnlock(link, NOW)).toEqual({ ok: false, reason: 'REVOKED' });
  });

  it('rejects a link past its expiresAt', () => {
    const link: ShareLinkRow = {
      ...base,
      expiresAt: new Date(NOW.getTime() - 1),
    };
    expect(canUnlock(link, NOW)).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('accepts a link with expiresAt in the future', () => {
    const link: ShareLinkRow = {
      ...base,
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    };
    expect(canUnlock(link, NOW)).toEqual({ ok: true });
  });

  it('rejects a link currently locked', () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000);
    const link: ShareLinkRow = { ...base, lockedUntil };
    expect(canUnlock(link, NOW)).toEqual({
      ok: false,
      reason: 'LOCKED',
      lockedUntil,
    });
  });

  it('accepts a link whose lockedUntil is in the past', () => {
    const link: ShareLinkRow = {
      ...base,
      lockedUntil: new Date(NOW.getTime() - 1),
      // Note: failedAttempts is NOT auto-reset by canUnlock — the
      // repo resets on successful unlock. Stale counter is fine
      // because lockedUntil < now means the link is usable again.
      failedAttempts: 50,
    };
    expect(canUnlock(link, NOW)).toEqual({ ok: true });
  });
});

describe('recordFailure', () => {
  const THRESHOLD = 20;
  const LOCKOUT_MS = 60 * 60 * 1000; // 1h

  it('increments failedAttempts without locking when below threshold', () => {
    const link: ShareLinkRow = { ...base, failedAttempts: 5 };
    const result = recordFailure(link, THRESHOLD, LOCKOUT_MS, NOW);
    expect(result.failedAttempts).toBe(6);
    expect(result.lockedUntil).toBeNull();
  });

  it('locks exactly on the threshold (19 → null, 20 → locked)', () => {
    const just_below: ShareLinkRow = { ...base, failedAttempts: 18 };
    expect(recordFailure(just_below, THRESHOLD, LOCKOUT_MS, NOW)).toEqual({
      failedAttempts: 19,
      lockedUntil: null,
    });

    const reaches: ShareLinkRow = { ...base, failedAttempts: 19 };
    const result = recordFailure(reaches, THRESHOLD, LOCKOUT_MS, NOW);
    expect(result.failedAttempts).toBe(20);
    expect(result.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_MS));
  });

  it('keeps locking the link on subsequent failures past the threshold', () => {
    const link: ShareLinkRow = {
      ...base,
      failedAttempts: 30,
      lockedUntil: new Date(NOW.getTime() - 1000), // stale lockedUntil
    };
    const result = recordFailure(link, THRESHOLD, LOCKOUT_MS, NOW);
    expect(result.failedAttempts).toBe(31);
    // Re-extends the lockout window from now, not from the stale value.
    expect(result.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_MS));
  });
});
