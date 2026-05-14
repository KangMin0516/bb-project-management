/**
 * Issue lifecycle status. Mirror of `IssueStatus` in prisma schema —
 * duplicated here on purpose: the domain layer must not import generated
 * Prisma code (that would couple pure domain to the ORM).
 *
 * Single source of truth for transition rules; the persistence mapper
 * is responsible for echoing the literal back into the Prisma column.
 */
export const ISSUE_STATUSES = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW_QA',
  'DONE',
  'CANCELED',
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Terminal statuses — an issue in DONE/CANCELED is no longer "open". */
export const TERMINAL_STATUSES: ReadonlySet<IssueStatus> = new Set([
  'DONE',
  'CANCELED',
]);

export function isTerminal(status: IssueStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return (
    typeof value === 'string' &&
    (ISSUE_STATUSES as readonly string[]).includes(value)
  );
}
