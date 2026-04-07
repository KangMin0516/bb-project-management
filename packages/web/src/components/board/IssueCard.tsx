import { memo, useMemo } from 'react'
import type { Issue } from '@/api/issues'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge, isIssueOverdue } from '@/lib/time'

interface Props {
  issue: Issue
  projectKey: string
  onClick: () => void
}

export default memo(function IssueCard({ issue, projectKey, onClick }: Props) {
  const dueBadge = useMemo(() => getDueBadge(issue.dueDate), [issue.dueDate])
  const overdue = isIssueOverdue(issue)

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      role="button"
      tabIndex={0}
      className={cn(
        'cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md',
        overdue ? 'border-red-300 border-l-4 border-l-red-500' : 'border-gray-200',
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
        <span className="font-mono text-xs text-gray-400">
          {projectKey}-{issue.number}
        </span>
        {dueBadge && (
          <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium', dueBadge.className)}>
            {dueBadge.text}
          </span>
        )}
      </div>
      {issue.parent && (
        <p className="mb-1 text-[10px] text-gray-400">↳ #{issue.parent.number}</p>
      )}
      {issue._count.children > 0 && (
        <p className="mb-1 text-[10px] text-gray-400">📎 {issue._count.children} sub-task{issue._count.children > 1 ? 's' : ''}</p>
      )}
      <p className="mb-2 text-sm font-medium leading-snug text-gray-900">{issue.title}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              PRIORITY_COLORS[issue.priority] || 'bg-gray-100 text-gray-600',
            )}
          >
            {issue.priority}
          </span>
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
        {issue.assignee && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700"
            title={issue.assignee.name}
          >
            {issue.assignee.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
})
