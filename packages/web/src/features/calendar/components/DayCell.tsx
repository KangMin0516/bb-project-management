import { useState } from 'react'
import type { Issue } from '@/features/issue/api'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { isSameMonth, isToday } from '@/features/calendar/lib'
import { cn } from '@/shared/lib/utils'
import IssueChip from '@/features/calendar/components/IssueChip'

interface DayCellProps {
  date: Date
  /** Anchor month — cells outside it render dimmed (padding). */
  cursorMonth: Date
  issues: Issue[]
  projectKey: string | undefined
  onSelectIssue: (issue: Issue) => void
}

const MAX_VISIBLE = 3

export default function DayCell({
  date,
  cursorMonth,
  issues,
  projectKey,
  onSelectIssue,
}: DayCellProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const inMonth = isSameMonth(date, cursorMonth)
  const today = isToday(date)
  const visible = issues.slice(0, MAX_VISIBLE)
  const overflowCount = issues.length - visible.length

  return (
    <div
      className={cn(
        'flex min-h-[110px] flex-col gap-1 border-b border-r border-gray-200 dark:border-gray-700 p-1.5',
        !inMonth && 'bg-gray-50 dark:bg-gray-900/40',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium',
            today
              ? 'bg-primary-600 text-white'
              : inMonth
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-400 dark:text-gray-600',
          )}
        >
          {date.getDate()}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {visible.map((issue) => (
          <IssueChip
            key={issue.id}
            issue={issue}
            projectKey={projectKey}
            onClick={() => onSelectIssue(issue)}
          />
        ))}

        {overflowCount > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                onClick={(e) => e.stopPropagation()}
              >
                +{overflowCount} more
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
              <div className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                {issues.length} issue{issues.length === 1 ? '' : 's'} due{' '}
                {date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {issues.map((issue) => (
                  <IssueChip
                    key={issue.id}
                    issue={issue}
                    projectKey={projectKey}
                    onClick={() => {
                      setPopoverOpen(false)
                      onSelectIssue(issue)
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
