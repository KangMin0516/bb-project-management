import { AlertTriangle } from 'lucide-react'
import type { GlobalOverdueIssue } from '@/features/dashboard/api'
import { PRIORITY_COLORS } from '@/shared/config/constants'
import { getDueBadge } from '@/shared/lib/time'
import { cn } from '@/shared/lib/utils'

interface GlobalOverduePanelProps {
  issues: GlobalOverdueIssue[]
  totalOverdueCount: number
  onIssueClick: (issue: GlobalOverdueIssue) => void
}

export default function GlobalOverduePanel({ issues, totalOverdueCount, onIssueClick }: GlobalOverduePanelProps) {
  const hasIssues = issues.length > 0
  return (
    <div
      className={cn(
        'rounded-xl border p-5',
        hasIssues ? 'border-red-200 bg-red-50/50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className={cn('h-4 w-4', hasIssues ? 'text-red-500' : 'text-gray-400 dark:text-gray-500')} />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Overdue</h2>
        {totalOverdueCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
            {totalOverdueCount}
          </span>
        )}
      </div>

      {!hasIssues ? (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No overdue issues</p>
      ) : (
        <div className="space-y-1">
          {issues.map((issue) => {
            const badge = getDueBadge(issue.dueDate)
            return (
              <div
                key={issue.id}
                onClick={() => onIssueClick(issue)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-red-100/50"
              >
                <span className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {issue.project.key}
                </span>
                <span className="font-mono text-xs text-gray-400 dark:text-gray-500">#{issue.number}</span>
                <span className="flex-1 truncate text-sm font-medium text-red-700">{issue.title}</span>
                {badge && (
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>{badge.text}</span>
                )}
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                  {issue.priority}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
