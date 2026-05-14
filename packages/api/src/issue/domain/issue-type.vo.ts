export const ISSUE_TYPES = ['EPIC', 'TASK', 'BUG', 'SUB_TASK'] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export function isIssueType(value: unknown): value is IssueType {
  return (
    typeof value === 'string' &&
    (ISSUE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Hierarchy invariants per behavior-preservation-checklist §2.1 (I-C1, I-C2,
 * I-C3). These are pure functions on type alone — they don't need a DB hit,
 * so we keep them in the domain layer. Cycle detection (I-U2) needs to walk
 * the actual parent chain and belongs in a domain service that takes a
 * repository lookup as a callback (see issue-hierarchy.service.ts at M3).
 */
export type HierarchyError =
  | 'EPIC_CANNOT_HAVE_PARENT'
  | 'SUB_TASK_REQUIRES_PARENT'
  | 'PARENT_CANNOT_BE_SUB_TASK'
  | 'CANNOT_BE_OWN_PARENT';

export function validateTypeWithParent(
  type: IssueType,
  parentId: string | null,
  parentType: IssueType | null,
  ownId: string | null = null,
): HierarchyError | null {
  if (type === 'EPIC' && parentId) return 'EPIC_CANNOT_HAVE_PARENT';
  if (type === 'SUB_TASK' && !parentId) return 'SUB_TASK_REQUIRES_PARENT';
  if (parentId && ownId && parentId === ownId) return 'CANNOT_BE_OWN_PARENT';
  if (parentType === 'SUB_TASK') return 'PARENT_CANNOT_BE_SUB_TASK';
  return null;
}
