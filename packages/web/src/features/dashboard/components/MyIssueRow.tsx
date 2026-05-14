import { Star } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { getDueBadge, isOverdue } from '@/shared/lib/time'
import { cn } from '@/shared/lib/utils'

interface MyIssueRowProps {
  issue: Issue
  projectKey: string
  focused: boolean
  onToggleFocus: (issue: Issue) => void
  onClick: () => void
}

/**
 * One row in the personal-dashboard issue lists. Toggle-focus star sits on
 * the left; clicking the title opens the issue. The row goes red when
 * overdue (but only outside the "today's focus" buckets — once focused,
 * overdue colour stops adding signal).
 */
export default function MyIssueRow({ issue, projectKey, focused, onToggleFocus, onClick }: MyIssueRowProps) {
  const badge = getDueBadge(issue.dueDate)
  const overdue = !focused && isOverdue(issue.dueDate)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150',
        focused ? 'bg-gray-50 dark:bg-gray-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
        overdue && 'bg-red-50/50',
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFocus(issue) }}
        className={cn('transition', focused ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400')}
        title={focused ? "Remove from today's focus" : "Add to today's focus"}
      >
        <Star className={cn('h-3.5 w-3.5', focused && 'fill-current')} />
      </button>
      <span className="text-xs">{TYPE_ICONS[issue.type] || ''}</span>
      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{projectKey}-{issue.number}</span>
      <span
        onClick={onClick}
        className={cn(
          'flex-1 cursor-pointer truncate text-sm font-medium transition-colors duration-150 hover:text-primary-600 dark:hover:text-primary-400',
          overdue ? 'text-red-700' : 'text-gray-900 dark:text-gray-100',
        )}
      >
        {issue.title}
      </span>
      {badge && (
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>{badge.text}</span>
      )}
      <div className="flex items-center gap-1.5">
        <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{issue.status.replace(/_/g, ' ')}</span>
      </div>
      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
        {issue.priority}
      </span>
    </div>
  )
}
