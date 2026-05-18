import { describe, expect, it } from '@jest/globals';
import { scheduledTodayInTz } from './standup.scheduler.js';

/**
 * Regression: prior version subtracted the tz offset twice for any
 * non-UTC zone, causing standups configured for 08:30 VN to fire at
 * 01:30 VN and 17:06 VN to fire at 10:06 VN.
 */
describe('scheduledTodayInTz', () => {
  it('resolves 08:30 Asia/Ho_Chi_Minh to 01:30Z on the same VN calendar day', () => {
    const now = new Date('2026-05-18T04:00:00Z'); // 11:00 VN, May 18
    const result = scheduledTodayInTz(now, 'Asia/Ho_Chi_Minh', 8, 30);
    expect(result.toISOString()).toBe('2026-05-18T01:30:00.000Z');
  });

  it('resolves 17:06 Asia/Ho_Chi_Minh to 10:06Z on the same VN calendar day', () => {
    const now = new Date('2026-05-18T04:00:00Z');
    const result = scheduledTodayInTz(now, 'Asia/Ho_Chi_Minh', 17, 6);
    expect(result.toISOString()).toBe('2026-05-18T10:06:00.000Z');
  });

  it('resolves 09:00 Asia/Seoul to 00:00Z on the same KST calendar day', () => {
    const now = new Date('2026-05-18T04:00:00Z'); // 13:00 KST, May 18
    const result = scheduledTodayInTz(now, 'Asia/Seoul', 9, 0);
    expect(result.toISOString()).toBe('2026-05-18T00:00:00.000Z');
  });

  it('uses the calendar day observed in the config tz, not UTC', () => {
    // 2026-05-18T23:00Z is already May 19 in Asia/Ho_Chi_Minh (06:00 VN).
    const now = new Date('2026-05-18T23:00:00Z');
    const result = scheduledTodayInTz(now, 'Asia/Ho_Chi_Minh', 8, 30);
    expect(result.toISOString()).toBe('2026-05-19T01:30:00.000Z');
  });

  it('handles DST zones — America/New_York 09:00 in summer (EDT, UTC-4)', () => {
    const now = new Date('2026-07-15T12:00:00Z'); // 08:00 EDT
    const result = scheduledTodayInTz(now, 'America/New_York', 9, 0);
    expect(result.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('handles DST zones — America/New_York 09:00 in winter (EST, UTC-5)', () => {
    const now = new Date('2026-01-15T12:00:00Z'); // 07:00 EST
    const result = scheduledTodayInTz(now, 'America/New_York', 9, 0);
    expect(result.toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('passes through UTC unchanged', () => {
    const now = new Date('2026-05-18T04:00:00Z');
    const result = scheduledTodayInTz(now, 'UTC', 9, 0);
    expect(result.toISOString()).toBe('2026-05-18T09:00:00.000Z');
  });
});
