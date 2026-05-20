import { CalendarOff, FilterX } from 'lucide-react'
import { formatMonth } from '@/features/calendar/lib'

interface EmptyMonthBannerProps {
  cursorMonth: Date
  total: number
  filteredCount: number
  hasFilters: boolean
  onClearFilters: () => void
}

/**
 * Banner shown above the month grid when no chips render. Tells the
 * user *why* the grid is empty so they don't suspect a broken page:
 *
 *   - No issues in the month range at all → "Set a deadline" nudge.
 *   - Issues exist but a filter excludes them all → offer to clear.
 *
 * The grid still renders below this banner so date context (today /
 * prev / next month padding) stays visible.
 */
export default function EmptyMonthBanner({
  cursorMonth,
  total,
  filteredCount,
  hasFilters,
  onClearFilters,
}: EmptyMonthBannerProps) {
  if (filteredCount > 0) return null
  const monthLabel = formatMonth(cursorMonth.getFullYear(), cursorMonth.getMonth())
  const filteredOut = total > 0 && filteredCount === 0

  if (filteredOut && hasFilters) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-900/20">
        <FilterX className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <span className="font-medium text-amber-900 dark:text-amber-200">
            All {total} deadline{total === 1 ? '' : 's'} in {monthLabel} were filtered out.
          </span>
        </div>
        <button
          onClick={onClearFilters}
          className="rounded border border-amber-300 dark:border-amber-700 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/60">
      <CalendarOff className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
      <div className="flex-1 text-gray-600 dark:text-gray-300">
        No deadlines in <span className="font-medium">{monthLabel}</span>. Browse other
        months with ← →, or set a Due Date on the issue detail panel to pin it here.
      </div>
    </div>
  )
}
