/**
 * Project key — short uppercase identifier appearing in issue numbers
 * (e.g. "ALP" → "ALP-42"). Validated at creation; the actual unique
 * constraint is enforced by the DB.
 */
export type ProjectKeyError = 'EMPTY' | 'TOO_LONG' | 'INVALID_CHARS';

const MAX_LENGTH = 16;
const PATTERN = /^[A-Z][A-Z0-9_]{0,15}$/;

export function validateProjectKey(value: string): ProjectKeyError | null {
  if (!value) return 'EMPTY';
  if (value.length > MAX_LENGTH) return 'TOO_LONG';
  if (!PATTERN.test(value)) return 'INVALID_CHARS';
  return null;
}
