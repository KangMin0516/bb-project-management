import type { Issue } from '@/features/issue/api'

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
