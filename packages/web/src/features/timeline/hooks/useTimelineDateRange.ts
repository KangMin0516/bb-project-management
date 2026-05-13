import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import { DAY_MS, startOfDay } from '@/features/timeline/lib'

export interface TimelineDateRange {
  startDate: Date
  endDate: Date
  totalDays: number
  weeks: { date: Date; offset: number }[]
}

/**
 * Derives a chart-friendly [start, end] window from a set of issues plus
 * the Monday-aligned week markers used as gridlines. Padding (7 days
 * before, 14 after) keeps "today" comfortably away from the edges and
 * leaves room for new issues without re-zooming.
 */
export function useTimelineDateRange(issues: Issue[]): TimelineDateRange {
  return useMemo(() => {
    const now = startOfDay(new Date())
    let earliest = now
    let latest = new Date(now.getTime() + 30 * DAY_MS)

    for (const issue of issues) {
      const begin = startOfDay(new Date(issue.startDate ?? issue.createdAt))
      if (begin < earliest) earliest = begin
      if (issue.dueDate) {
        const due = startOfDay(new Date(issue.dueDate))
        if (due > latest) latest = due
      }
    }

    const start = new Date(earliest.getTime() - 7 * DAY_MS)
    const end = new Date(latest.getTime() + 14 * DAY_MS)
    const total = Math.ceil((end.getTime() - start.getTime()) / DAY_MS)

    const weekMarkers: { date: Date; offset: number }[] = []
    const cur = new Date(start)
    // Align cursor to the next Monday so columns land on week boundaries.
    const dayOfWeek = cur.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    cur.setDate(cur.getDate() + daysToMonday)
    while (cur <= end) {
      const offset = ((cur.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100
      weekMarkers.push({ date: new Date(cur), offset })
      cur.setDate(cur.getDate() + 7)
    }

    return { startDate: start, endDate: end, totalDays: total, weeks: weekMarkers }
  }, [issues])
}
