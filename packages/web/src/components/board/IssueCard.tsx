import { memo, useMemo } from 'react'
import type { Issue } from '@/api/issues'
import type { ChildIssue } from './types'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, TYPE_ICONS, STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { getDueBadge, isIssueOverdue } from '@/lib/time'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface Props {
  issue: Issue
  projectKey: string
  onClick: () => void
  childIssues?: ChildIssue[]
  isExpanded?: boolean
  onToggleExpand?: (issueId: string) => void
  onChildClick?: (child: ChildIssue) => void
  onChildStatusToggle?: (child: ChildIssue) => void
}

export default memo(function IssueCard({
  issue,
  projectKey,
  onClick,
  childIssues,
  isExpanded,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
}: Props) {
  const dueBadge = useMemo(() => getDueBadge(issue.dueDate), [issue.dueDate])
  const overdue = isIssueOverdue(issue)
  const childList = childIssues || []
  const hasChildren = childList.length > 0
  const doneCount = childList.filter((c) => c.status === 'DONE').length
  const totalCount = childList.length

  return (
    <div>
      <div
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        role="button"
        tabIndex={0}
        className={cn(
          'cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md',
          overdue ? 'border-red-300 border-l-4 border-l-red-500' : 'border-gray-200',
          isExpanded && hasChildren && 'rounded-b-none border-b-0',
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
        <p className="mb-2 text-sm font-medium leading-snug text-gray-900">{issue.title}</p>

        {/* Progress bar for parent issues */}
        {hasChildren && (
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand?.(issue.id)
                }}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
              >
                {isExpanded
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />
                }
                {totalCount} sub-task{totalCount > 1 ? 's' : ''}
              </button>
              <span className="text-[11px] font-medium text-gray-500">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

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

      {/* Expanded child issues */}
      {isExpanded && hasChildren && (
        <div className="rounded-b-lg border border-t-0 border-gray-200 bg-gray-50">
          {childList.map((child, idx) => (
            <div
              key={child.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100',
                idx < childList.length - 1 && 'border-b border-gray-100',
              )}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChildStatusToggle?.(child)
                }}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                  child.status === 'DONE'
                    ? 'border-green-400 bg-green-400 text-white'
                    : 'border-gray-300 bg-white hover:border-gray-400',
                )}
              >
                {child.status === 'DONE' && (
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChildClick?.(child)
                }}
                className={cn(
                  'flex-1 truncate text-left text-xs',
                  child.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-700',
                )}
              >
                {child.title}
              </button>
              <div
                className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[child.status] || 'bg-gray-300')}
                title={STATUS_LABELS[child.status] || child.status}
              />
              {child.assignee && (
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-medium text-primary-700"
                  title={child.assignee.name}
                >
                  {child.assignee.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
