import type { Issue } from '@/features/issue/api'

/**
 * YYYY-MM-DD in the user's local timezone — used to bucket issues by
 * their dueDate. `new Date(iso).getFullYear()` etc. return local-time
 * components, so `dueDate=2026-05-20T23:30:00Z` (16:30 ICT next day)
 * lands in the day the user actually picked when assigning, not the
 * raw UTC date.
 */
export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Droppable id for a day cell — prefixed so it can't collide with the
 * unscheduled panel's droppable. Mirror of the DnD lib's id convention. PM-58.
 */
export const DAY_DROPPABLE_PREFIX = 'day:'
export function dayCellDroppableId(date: Date): string {
  return `${DAY_DROPPABLE_PREFIX}${localDayKey(date)}`
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function isToday(d: Date): boolean {
  const today = new Date()
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

/**
 * Full Monday-Sunday grid for `(year, monthIndex)` — 35 or 42 cells
 * depending on how the month aligns. Pads the start with last days of
 * the previous month and the end with first days of the next month so
 * every week row is complete.
 */
export function getMonthGrid(year: number, monthIndex: number): Date[] {
  const firstOfMonth = new Date(year, monthIndex, 1)
  const lastOfMonth = new Date(year, monthIndex + 1, 0)

  // Monday-based weekday index: 0=Mon ... 6=Sun.
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7)

  const start = new Date(firstOfMonth)
  start.setDate(firstOfMonth.getDate() - startOffset)
  const totalDays = startOffset + lastOfMonth.getDate() + endOffset

  const grid: Date[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    grid.push(d)
  }
  return grid
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export function formatMonth(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`
}

/**
 * Group issues by their dueDate local-day key. Issues without `dueDate`
 * are excluded — they belong on Lists/Board, not Calendar.
 */
export function groupIssuesByDueDay(issues: Issue[]): Map<string, Issue[]> {
  const map = new Map<string, Issue[]>()
  for (const issue of issues) {
    if (!issue.dueDate) continue
    const key = localDayKey(new Date(issue.dueDate))
    const arr = map.get(key)
    if (arr) arr.push(issue)
    else map.set(key, [issue])
  }
  return map
}
