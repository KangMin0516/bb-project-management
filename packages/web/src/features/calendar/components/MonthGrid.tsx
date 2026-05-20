import type { Issue } from '@/features/issue/api'
import {
  WEEKDAY_LABELS,
  getMonthGrid,
  groupIssuesByDueDay,
  localDayKey,
} from '@/features/calendar/lib'
import DayCell from '@/features/calendar/components/DayCell'

interface MonthGridProps {
  cursorMonth: Date
  issues: Issue[]
  projectKey: string | undefined
  onSelectIssue: (issue: Issue) => void
}

export default function MonthGrid({
  cursorMonth,
  issues,
  projectKey,
  onSelectIssue,
}: MonthGridProps) {
  const days = getMonthGrid(cursorMonth.getFullYear(), cursorMonth.getMonth())
  const byDay = groupIssuesByDueDay(issues)

  return (
    <div className="flex h-full flex-col border-t border-l border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-r border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 auto-rows-fr">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            date={day}
            cursorMonth={cursorMonth}
            issues={byDay.get(localDayKey(day)) ?? []}
            projectKey={projectKey}
            onSelectIssue={onSelectIssue}
          />
        ))}
      </div>
    </div>
  )
}
