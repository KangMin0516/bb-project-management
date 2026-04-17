import { memo, useMemo, useRef, useEffect } from 'react'
import type { Issue } from '@/api/issues'
import type { ChildIssue } from './types'
import { cn } from '@/lib/utils'
import { useImagePreviewStore } from '@/stores/imagePreview'
import { PRIORITY_COLORS, TYPE_ICONS, STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { getDueBadge, isIssueOverdue } from '@/lib/time'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface IssueCardProps {
  issue: Issue
  projectKey: string
  onClick: () => void
  childIssues?: ChildIssue[]
  isExpanded?: boolean
  onToggleExpand?: (issueId: string) => void
  onChildClick?: (child: ChildIssue) => void
  onChildStatusToggle?: (child: ChildIssue) => void
  compact?: boolean
  isFocused?: boolean
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
  compact,
  isFocused,
}: IssueCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused])
  const dueBadge = useMemo(() => getDueBadge(issue.dueDate), [issue.dueDate])
  const overdue = isIssueOverdue(issue)
  const childList = childIssues || []
  const hasChildren = childList.length > 0
  const doneCount = childList.filter((c) => c.status === 'DONE').length
  const totalCount = childList.length

  return (
    <div ref={cardRef}>
      <div
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        role="button"
        tabIndex={0}
        className={cn(
          'cursor-pointer rounded-lg border bg-white shadow-sm transition hover:shadow-md',
          compact ? 'p-2' : 'p-3',
          overdue ? 'border-red-300 border-l-4 border-l-red-500' : 'border-gray-200',
          isExpanded && hasChildren && 'rounded-b-none border-b-0',
          issue.archivedAt && 'opacity-50',
          isFocused && 'ring-2 ring-primary-400 border-primary-300',
        )}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
          <span className="font-mono text-xs text-gray-400">
            {projectKey}-{issue.number}
          </span>
          {issue.isRecheck && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
              Recheck
            </span>
          )}
          {dueBadge && (
            <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium', dueBadge.className)}>
              {dueBadge.text}
            </span>
          )}
        </div>
        <p className={cn('font-medium leading-snug text-gray-900', compact ? 'mb-1.5 text-xs' : 'mb-2 text-sm')}>{issue.title}</p>

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
          {(issue.assignee || childList.length > 0) && (() => {
            // Collect unique sub-task assignees that differ from the task assignee
            const subAssignees = new Map<string, { name: string; avatar: string | null }>()
            for (const child of childList) {
              if (child.assignee && child.assignee.id !== issue.assigneeId) {
                subAssignees.set(child.assignee.id, child.assignee)
              }
            }
            const extras = [...subAssignees.values()]
            return (
              <div className="flex items-center -space-x-1.5">
                {extras.map((a) => (
                  <div
                    key={a.name}
                    className={cn('flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[8px] font-medium text-gray-500 overflow-hidden ring-1 ring-white opacity-50', a.avatar && 'cursor-pointer hover:opacity-80')}
                    title={a.name}
                    onClick={(e) => { if (a.avatar) { e.stopPropagation(); useImagePreviewStore.getState().open(a.avatar, a.name) } }}
                  >
                    {a.avatar ? (
                      <img src={a.avatar} alt={a.name} className="h-full w-full object-cover" />
                    ) : (
                      a.name.charAt(0).toUpperCase()
                    )}
                  </div>
                ))}
                {issue.assignee && (
                  <div
                    className={cn('flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700 overflow-hidden ring-1 ring-white z-10', issue.assignee.avatar && 'cursor-pointer hover:ring-2 hover:ring-primary-300')}
                    title={issue.assignee.name}
                    onClick={(e) => { if (issue.assignee?.avatar) { e.stopPropagation(); useImagePreviewStore.getState().open(issue.assignee.avatar, issue.assignee.name) } }}
                  >
                    {issue.assignee.avatar ? (
                      <img src={issue.assignee.avatar} alt={issue.assignee.name} className="h-full w-full object-cover" />
                    ) : (
                      issue.assignee.name.charAt(0).toUpperCase()
                    )}
                  </div>
                )}
              </div>
            )
          })()}
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
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-medium text-primary-700 overflow-hidden', child.assignee.avatar && 'cursor-pointer hover:ring-2 hover:ring-primary-300')}
                  title={child.assignee.name}
                  onClick={(e) => { if (child.assignee?.avatar) { e.stopPropagation(); useImagePreviewStore.getState().open(child.assignee.avatar, child.assignee.name) } }}
                >
                  {child.assignee.avatar ? (
                    <img src={child.assignee.avatar} alt={child.assignee.name} className="h-full w-full object-cover" />
                  ) : (
                    child.assignee.name.charAt(0).toUpperCase()
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
