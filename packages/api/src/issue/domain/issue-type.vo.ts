export const ISSUE_TYPES = [
  'DOMAIN',
  'EPIC',
  'TASK',
  'BUG',
  'SUB_TASK',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export function isIssueType(value: unknown): value is IssueType {
  return (
    typeof value === 'string' &&
    (ISSUE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Hierarchy invariants per behavior-preservation-checklist §2.1 (I-C1, I-C2,
 * I-C3) plus the Domain-level addition (Table of Content feature, plan:
 * docs/plans/table-of-content-domain-level.md). The 4-level tree is:
 *
 *   Domain → Epic → Task/Bug → Sub-task
 *
 * `DOMAIN` is a top-level grouping; UI labels it "Module" but the enum
 * stays as DOMAIN in code/API/DB. An `EPIC` may either be top-level
 * (legacy / unassigned) OR have a `DOMAIN` parent — never a Task or Bug.
 *
 * These are pure functions on type alone — they don't need a DB hit,
 * so we keep them in the domain layer. Cycle detection (I-U2) needs to walk
 * the actual parent chain and belongs in a domain service that takes a
 * repository lookup as a callback.
 */
export type HierarchyError =
  | 'DOMAIN_CANNOT_HAVE_PARENT'
  | 'EPIC_PARENT_MUST_BE_DOMAIN'
  | 'SUB_TASK_REQUIRES_PARENT'
  | 'PARENT_CANNOT_BE_SUB_TASK'
  | 'CANNOT_BE_OWN_PARENT';

export function validateTypeWithParent(
  type: IssueType,
  parentId: string | null,
  parentType: IssueType | null,
  ownId: string | null = null,
): HierarchyError | null {
  if (type === 'DOMAIN' && parentId) return 'DOMAIN_CANNOT_HAVE_PARENT';
  if (type === 'EPIC' && parentId && parentType !== 'DOMAIN')
    return 'EPIC_PARENT_MUST_BE_DOMAIN';
  if (type === 'SUB_TASK' && !parentId) return 'SUB_TASK_REQUIRES_PARENT';
  if (parentId && ownId && parentId === ownId) return 'CANNOT_BE_OWN_PARENT';
  if (parentType === 'SUB_TASK') return 'PARENT_CANNOT_BE_SUB_TASK';
  return null;
}
