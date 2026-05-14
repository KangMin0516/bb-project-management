export const ISSUE_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

/** Higher = more urgent. Used for ordering. */
export const PRIORITY_RANK: Record<IssuePriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function isIssuePriority(value: unknown): value is IssuePriority {
  return (
    typeof value === 'string' &&
    (ISSUE_PRIORITIES as readonly string[]).includes(value)
  );
}
