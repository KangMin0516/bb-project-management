import type { Issue } from '@/features/issue/api'
import type { SortRule } from '@/shared/ui/filterState'

export const DAY_MS = 86400000
export const NO_EPIC_KEY = '__no_epic__'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export interface BarStyle {
  left: string
  width: string
  minWidth: string
}

/**
 * Compute the absolute left/width of an issue's bar inside a [start, end]
 * range. Issues with no `dueDate` render as a small dot at their start;
 * issues with no `startDate` fall back to `createdAt`.
 */
export function computeBarStyle(issue: Issue, startDate: Date, endDate: Date): BarStyle {
  const range = endDate.getTime() - startDate.getTime()
  if (range === 0) return { left: '0%', width: '2px', minWidth: '2px' }

  const begin = startOfDay(new Date(issue.startDate ?? issue.createdAt))
  const leftPct = ((begin.getTime() - startDate.getTime()) / range) * 100

  if (!issue.dueDate && !issue.startDate) {
    return { left: `${Math.max(0, Math.min(leftPct, 99.5))}%`, width: '8px', minWidth: '8px' }
  }

  if (!issue.dueDate) {
    return { left: `${Math.max(0, leftPct)}%`, width: '8px', minWidth: '8px' }
  }

  const due = startOfDay(new Date(issue.dueDate))
  const widthPct = ((due.getTime() - begin.getTime()) / range) * 100

  return {
    left: `${Math.max(0, leftPct)}%`,
    width: `${Math.max(0.3, widthPct)}%`,
    minWidth: '12px',
  }
}

export function clampDate(d: Date, min: Date, max: Date): Date {
  if (d < min) return min
  if (d > max) return max
  return d
}

/**
 * Convert a pixel offset (from the chart's inner-wrapper left edge) into a
 * day-aligned Date inside the timeline's [start, end] window. Snaps to the
 * nearest day boundary so the gesture lands on whole days instead of jittery
 * sub-day fractions. Used by the drag-to-set-dates hook.
 */
export function pixelToDate(
  pixelOffsetFromChartLeft: number,
  rangeStart: Date,
  rangeEnd: Date,
  chartWidthPx: number,
): Date {
  if (chartWidthPx <= 0) return startOfDay(rangeStart)
  const totalDays = Math.max(
    1,
    Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS),
  )
  const dayWidth = chartWidthPx / totalDays
  const dayOffset = Math.round(pixelOffsetFromChartLeft / dayWidth)
  const target = new Date(rangeStart.getTime() + dayOffset * DAY_MS)
  return clampDate(startOfDay(target), startOfDay(rangeStart), startOfDay(rangeEnd))
}

// Ordinal maps for non-string sort fields. Order mirrors the BE enum
// declarations in `IssueQueryService` so the FE-side comparator agrees
// with what `?sort=priority:desc` would return on Lists / Board.
const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const STATUS_RANK: Record<string, number> = {
  BACKLOG: 0,
  TODO: 1,
  IN_PROGRESS: 2,
  REVIEW_QA: 3,
  RECHECK: 4,
  DONE: 5,
  CANCELED: 6,
}

function compareField(a: Issue, b: Issue, field: SortRule['field']): number {
  switch (field) {
    case 'priority':
      return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99)
    case 'status':
      return (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99)
    case 'title':
      return a.title.localeCompare(b.title)
    case 'number':
      return a.number - b.number
    case 'dueDate':
    case 'startDate':
    case 'createdAt':
    case 'updatedAt': {
      const av = a[field]
      const bv = b[field]
      if (!av && !bv) return 0
      if (!av) return 1 // nulls last on asc
      if (!bv) return -1
      return new Date(av).getTime() - new Date(bv).getTime()
    }
  }
}

/**
 * Build a comparator from a `SortRule[]`. Multi-key: applies each rule in
 * order, breaks tie with the next. Falls back to `createdAt` asc when the
 * stack is empty so order stays stable.
 */
export function makeIssueComparator(stack: SortRule[]): (a: Issue, b: Issue) => number {
  if (stack.length === 0) {
    return (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }
  return (a, b) => {
    for (const rule of stack) {
      const cmp = compareField(a, b, rule.field)
      if (cmp !== 0) return rule.dir === 'desc' ? -cmp : cmp
    }
    return 0
  }
}

export type GroupBy = 'epic' | 'type' | 'assignee'
export const GROUP_BY_OPTIONS = ['epic', 'type', 'assignee'] as const satisfies readonly GroupBy[]

export interface EpicGroup {
  key: string
  epic: Issue | null
  children: Issue[]
}

export type TimelineRow =
  | { kind: 'epic'; epic: Issue; childCount: number; collapsed: boolean }
  | { kind: 'no-epic'; childCount: number; collapsed: boolean }
  | { kind: 'group'; label: string; count: number }
  | { kind: 'issue'; issue: Issue; indent: number }
