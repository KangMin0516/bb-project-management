import { describe, expect, it } from '@jest/globals';
import { nextBackoffMs } from './outbox.repository.js';

describe('nextBackoffMs', () => {
  it('starts at 60s for attempt 0', () => {
    expect(nextBackoffMs(0)).toBe(60_000);
  });

  it('doubles for each attempt', () => {
    expect(nextBackoffMs(1)).toBe(120_000);
    expect(nextBackoffMs(2)).toBe(240_000);
    expect(nextBackoffMs(3)).toBe(480_000);
  });

  it('caps at 1 hour', () => {
    expect(nextBackoffMs(10)).toBe(60 * 60 * 1000);
    expect(nextBackoffMs(20)).toBe(60 * 60 * 1000);
  });
});
