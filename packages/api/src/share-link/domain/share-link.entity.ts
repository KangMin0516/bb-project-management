/**
 * Domain layer for ShareLink — pure functions over the persistence row
 * shape. Use cases consume these to decide whether to proceed; the
 * Prisma repository is the only place that writes the new state back.
 *
 * Lockout machine: every failed unlock bumps `failedAttempts`; once it
 * crosses the threshold, `lockedUntil` is set to `now + lockoutMs`.
 * A successful unlock resets both counters in the repo (not here).
 */

export interface ShareLinkRow {
  failedAttempts: number;
  lockedUntil: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export type LockoutReason = 'EXPIRED' | 'REVOKED' | 'LOCKED';

export type CanUnlockResult =
  | { ok: true }
  | { ok: false; reason: LockoutReason; lockedUntil?: Date };

/**
 * Decide whether the link is currently usable. Revocation is final,
 * expiry is wall-clock, lockout is a temporary brute-force defence
 * with a known end timestamp.
 */
export function canUnlock(link: ShareLinkRow, now: Date): CanUnlockResult {
  if (link.revokedAt) return { ok: false, reason: 'REVOKED' };
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime())
    return { ok: false, reason: 'EXPIRED' };
  if (link.lockedUntil && link.lockedUntil.getTime() > now.getTime())
    return { ok: false, reason: 'LOCKED', lockedUntil: link.lockedUntil };
  return { ok: true };
}

/**
 * Compute the new lockout state after a failed unlock attempt. Caller
 * (UnlockShareLinkUseCase) is responsible for persisting the result.
 */
export function recordFailure(
  link: ShareLinkRow,
  threshold: number,
  lockoutMs: number,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const failedAttempts = link.failedAttempts + 1;
  const lockedUntil =
    failedAttempts >= threshold
      ? new Date(now.getTime() + lockoutMs)
      : link.lockedUntil;
  return { failedAttempts, lockedUntil };
}
