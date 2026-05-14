import type { GlobalIssue } from '@/features/dashboard/api'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_ICONS } from '@/shared/config/constants'
import { getDueBadge } from '@/shared/lib/time'
import { cn } from '@/shared/lib/utils'

interface TeamIssueRowProps {
  issue: GlobalIssue
  projectKey: string
  isSelected: boolean
  onClick: () => void
}

export default function TeamIssueRow({ issue, projectKey, isSelected, onClick }: TeamIssueRowProps) {
  const dueBadge = issue.dueDate ? getDueBadge(issue.dueDate) : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition',
        isSelected && 'bg-primary-50 dark:bg-primary-900/20',
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
      <span className="shrink-0 text-xs">{TYPE_ICONS[issue.type] ?? '📌'}</span>
      <span className="shrink-0 text-xs font-mono text-gray-400 dark:text-gray-500">{projectKey}-{issue.number}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{issue.title}</span>
      {issue.assignee ? (
        <span className="hidden sm:inline shrink-0 text-[10px] text-gray-500 dark:text-gray-400">{issue.assignee.name}</span>
      ) : (
        <span className="hidden sm:inline shrink-0 rounded bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
          Unassigned
        </span>
      )}
      {issue.labels?.length > 0 && (
        <div className="hidden lg:flex items-center gap-1">
          {issue.labels.slice(0, 2).map((l) => (
            <span
              key={l.label.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: l.label.color + '20', color: l.label.color }}
            >
              {l.label.name}
            </span>
          ))}
        </div>
      )}
      <span className="hidden sm:inline rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        {STATUS_LABELS[issue.status] ?? issue.status}
      </span>
      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
        {PRIORITY_LABELS[issue.priority] ?? issue.priority}
      </span>
      {dueBadge && (
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', dueBadge.className)}>{dueBadge.text}</span>
      )}
    </button>
  )
}
