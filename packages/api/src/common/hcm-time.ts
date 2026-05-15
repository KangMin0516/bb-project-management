/**
 * Returns the current wall-clock time in Asia/Ho_Chi_Minh as
 * `YYYY-MM-DD HH:MM:SS`. Embedded in log message bodies so timestamps
 * remain meaningful regardless of the container's `TZ` env (which we
 * deliberately don't standardise across environments).
 */
export function hcmTimestamp(): string {
  // sv-SE locale renders dates as ISO-like without the `T` separator —
  // friendlier to read in `docker logs` output than `toISOString()`.
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}
