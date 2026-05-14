import type { Issue } from '@/features/issue/api'
import { STATUS_COLORS, STATUS_LABELS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '@/entities/user/UserAvatar'
import { formatDate } from '@/features/timeline/lib'

interface TimelineTooltipProps {
  issue: Issue
  projectKey: string | undefined
  position: { x: number; y: number }
}

export default function TimelineTooltip({ issue, projectKey, position }: TimelineTooltipProps) {
  return (
    <div
      className="fixed z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg dark:shadow-gray-900/50 pointer-events-none"
      style={{ left: position.x + 12, top: position.y - 10 }}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{projectKey}-{issue.number}</span>
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 max-w-[240px] truncate">{issue.title}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span>{STATUS_LABELS[issue.status] || issue.status}</span>
        <span>{issue.priority}</span>
        {issue.assignee && (
          <span className="flex items-center gap-1">
            <UserAvatar user={issue.assignee} size="xs" />
            {issue.assignee.name}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
        {formatDate(new Date(issue.startDate ?? issue.createdAt))}
        {issue.dueDate && ` — ${formatDate(new Date(issue.dueDate))}`}
        {!issue.startDate && !issue.dueDate && ' (no dates set)'}
        {issue.startDate && !issue.dueDate && ' (no due date)'}
        {!issue.startDate && issue.dueDate && ' (no start date)'}
      </div>
    </div>
  )
}
