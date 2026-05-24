import type { SpecItem, SpecItemIssueSummary } from '@/features/specification/api'

export type SpecItemRollupStatus =
  | 'UNPLANNED'
  | 'BACKLOG'
  | 'IN_PROGRESS'
  | 'DONE'

/**
 * Compute the rollup status for a single SpecItem from its linked issues.
 * "Lowest-progress wins" — a single non-DONE issue keeps the item out of DONE.
 * CANCELED issues are excluded from the aggregate so the PM can cancel
 * one of several work paths without dragging the item back to BACKLOG.
 */
export function rollupItemStatus(item: SpecItem): SpecItemRollupStatus {
  const live = item.issueLinks
    .map((l) => l.issue)
    .filter((i) => i.status !== 'CANCELED')

  if (live.length === 0) return 'UNPLANNED'
  if (live.every((i) => i.status === 'DONE')) return 'DONE'
  if (live.some((i) => isInProgress(i))) return 'IN_PROGRESS'
  return 'BACKLOG'
}

function isInProgress(issue: SpecItemIssueSummary): boolean {
  return (
    issue.status === 'IN_PROGRESS' ||
    issue.status === 'REVIEW_QA' ||
    issue.status === 'RECHECK'
  )
}

export interface SpecProgressSummary {
  total: number
  done: number
  inProgress: number
  backlog: number
  unplanned: number
}

export function summariseProgress(items: SpecItem[]): SpecProgressSummary {
  const active = items.filter((i) => !i.archivedAt)
  const summary: SpecProgressSummary = {
    total: active.length,
    done: 0,
    inProgress: 0,
    backlog: 0,
    unplanned: 0,
  }
  for (const it of active) {
    const s = rollupItemStatus(it)
    if (s === 'DONE') summary.done += 1
    else if (s === 'IN_PROGRESS') summary.inProgress += 1
    else if (s === 'BACKLOG') summary.backlog += 1
    else summary.unplanned += 1
  }
  return summary
}

export const ITEM_STATUS_LABEL: Record<SpecItemRollupStatus, string> = {
  UNPLANNED: 'Unplanned',
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
}

export const ITEM_STATUS_DOT_CLASS: Record<SpecItemRollupStatus, string> = {
  UNPLANNED: 'bg-gray-300 dark:bg-gray-600',
  BACKLOG: 'bg-gray-400 dark:bg-gray-500',
  IN_PROGRESS: 'bg-amber-500',
  DONE: 'bg-emerald-500',
}
