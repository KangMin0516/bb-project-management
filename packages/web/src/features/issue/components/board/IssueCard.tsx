import { memo, useMemo, useRef, useEffect, useState } from 'react'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from './types'
import { cn } from '@/shared/lib/utils'
import { useImagePreviewStore } from '@/shared/lib/imagePreview'
import { PRIORITY_COLORS, TYPE_ICONS, STATUS_COLORS, STATUS_LABELS } from '@/shared/config/constants'
import { getDueBadge, isIssueOverdue } from '@/shared/lib/time'
import { ChevronRight, ChevronDown, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'

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
  /** Available epics for the inline "change Epic" chip. */
  epics?: Issue[]
  /** Called when the user picks a new Epic from the chip. */
  onEpicChange?: (issueId: string, newParentId: string | null) => void
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
  epics,
  onEpicChange,
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
          'cursor-pointer rounded-lg border bg-white dark:bg-gray-700 shadow-sm transition hover:shadow-md',
          compact ? 'p-2' : 'p-3',
          overdue ? 'border-red-300 dark:border-red-700 border-l-4 border-l-red-500' : 'border-gray-200 dark:border-gray-600',
          isExpanded && hasChildren && 'rounded-b-none border-b-0',
          issue.archivedAt && 'opacity-50',
          isFocused && 'ring-2 ring-primary-400 border-primary-300',
        )}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
            {projectKey}-{issue.number}
          </span>
          {(issue.type === 'TASK' || issue.type === 'BUG') && onEpicChange && epics && (
            <EpicChip
              issue={issue}
              epics={epics}
              onChange={(newParentId) => onEpicChange(issue.id, newParentId)}
            />
          )}
          {issue.isRecheck && (
            <span className="rounded bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-400">
              Recheck
            </span>
          )}
          {dueBadge && (
            <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium', dueBadge.className)}>
              {dueBadge.text}
            </span>
          )}
        </div>
        <p className={cn('font-medium leading-snug break-words text-gray-900 dark:text-gray-100', compact ? 'mb-1.5 text-xs' : 'mb-2 text-sm')}>{issue.title}</p>

        {/* Progress bar for parent issues */}
        {hasChildren && (
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand?.(issue.id)
                }}
                className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {isExpanded
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />
                }
                {totalCount} sub-task{totalCount > 1 ? 's' : ''}
              </button>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-2 min-w-0">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                PRIORITY_COLORS[issue.priority] || 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400',
              )}
            >
              {issue.priority}
            </span>
            {issue.labels.slice(0, 2).map((l) => (
              <span
                key={l.label.id}
                className="max-w-full truncate rounded border px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: l.label.color + '33',
                  color: l.label.color,
                  borderColor: l.label.color + '66',
                }}
                title={l.label.name}
              >
                {l.label.name}
              </span>
            ))}
            {issue.labels.length > 2 && (
              <span
                className="shrink-0 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400"
                title={issue.labels.slice(2).map((l) => l.label.name).join(', ')}
              >
                +{issue.labels.length - 2}
              </span>
            )}
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
              <div className="flex shrink-0 items-center -space-x-1.5">
                {extras.map((a) => (
                  <div
                    key={a.name}
                    className={cn('flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-[8px] font-medium text-gray-500 dark:text-gray-400 overflow-hidden ring-1 ring-white dark:ring-gray-700 opacity-50', a.avatar && 'cursor-pointer hover:opacity-80')}
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
                    className={cn('flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-[10px] font-medium text-primary-700 dark:text-primary-300 overflow-hidden ring-1 ring-white dark:ring-gray-700 z-10', issue.assignee.avatar && 'cursor-pointer hover:ring-2 hover:ring-primary-300')}
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
        <div className="rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
          {childList.map((child, idx) => (
            <div
              key={child.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700',
                idx < childList.length - 1 && 'border-b border-gray-100 dark:border-gray-700',
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
                    : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-400',
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
                  child.status === 'DONE' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300',
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
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-[9px] font-medium text-primary-700 dark:text-primary-300 overflow-hidden', child.assignee.avatar && 'cursor-pointer hover:ring-2 hover:ring-primary-300')}
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

const NO_EPIC = '__none__'

/**
 * Inline Epic picker rendered as a small chip on Task/Bug cards.
 * Stops propagation so the click doesn't bubble up to the card's
 * onClick (open detail) or the dnd drag handle.
 */
function EpicChip({
  issue,
  epics,
  onChange,
}: {
  issue: Issue
  epics: Issue[]
  onChange: (newParentId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const parent = issue.parent && issue.parent.type === 'EPIC' ? issue.parent : null
  const label = parent ? parent.title : 'No epic'
  const currentValue = parent ? parent.id : NO_EPIC

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          className={cn(
            'inline-flex max-w-[120px] items-center gap-0.5 truncate rounded px-1 py-0.5 text-[10px] font-medium transition',
            parent
              ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
              : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-500',
          )}
          title={parent ? `Epic: ${label}` : 'No epic — click to set'}
        >
          <span>⚡</span>
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search epic..." />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="No epic"
                onSelect={() => { onChange(null); setOpen(false) }}
              >
                <Check className={cn('h-4 w-4', currentValue === NO_EPIC ? 'opacity-100' : 'opacity-0')} />
                No epic
              </CommandItem>
              {epics.map((ep) => (
                <CommandItem
                  key={ep.id}
                  value={`${ep.number} ${ep.title}`}
                  onSelect={() => { onChange(ep.id); setOpen(false) }}
                >
                  <Check className={cn('h-4 w-4', currentValue === ep.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">⚡ #{ep.number} {ep.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
