import { memo, useMemo, useEffect, useRef } from 'react'
import { Droppable, Draggable, type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from './types'
import IssueCard from './IssueCard'
import UserAvatar from '@/entities/user/UserAvatar'
import { cn } from '@/shared/lib/utils'
import { STATUSES, STATUS_COLORS, STATUS_LABELS, STATUS_BADGE_COLORS } from '@/shared/config/constants'
import { ChevronRight, ChevronDown, Plus, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'

interface SwimlaneRowProps {
  epic: Issue | null
  issues: Record<string, Issue[]>
  projectKey: string
  projectId: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  onIssueClick: (issue: Issue) => void
  /** Click the Epic title/ID to open its detail panel. */
  onEpicClick?: (epic: Issue) => void
  onAddClick?: (status: string) => void
  childrenMap: Map<string, ChildIssue[]>
  expandedIssues: Set<string>
  onToggleExpand: (issueId: string) => void
  onChildClick: (child: ChildIssue) => void
  onChildStatusToggle: (child: ChildIssue) => void
  epics?: Issue[]
  onEpicChange?: (issueId: string, newParentId: string | null) => void
  /** Drag handle for reordering the whole swimlane (from dnd Draggable). */
  dragHandleProps?: DraggableProvidedDragHandleProps
  /** Move this swimlane up/down by one position. Undefined when at the edge. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** Hook into parent's horizontal scroll-sync. */
  registerScrollContainer?: (el: HTMLDivElement | null) => void
  unregisterScrollContainer?: (el: HTMLDivElement) => void
  onColumnsScroll?: (source: HTMLDivElement) => void
}

export default memo(function SwimlaneRow({
  epic,
  issues,
  projectKey,
  projectId,
  isCollapsed,
  onToggleCollapse,
  onIssueClick,
  onEpicClick,
  onAddClick,
  childrenMap,
  expandedIssues,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
  epics,
  onEpicChange,
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  registerScrollContainer,
  unregisterScrollContainer,
  onColumnsScroll,
}: SwimlaneRowProps) {
  const columnsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = columnsRef.current
    if (!el || !registerScrollContainer) return
    registerScrollContainer(el)
    return () => {
      unregisterScrollContainer?.(el)
    }
  }, [registerScrollContainer, unregisterScrollContainer, isCollapsed])
  const totalCount = useMemo(() => {
    let count = 0
    for (const arr of Object.values(issues)) count += arr.length
    return count
  }, [issues])

  const doneCount = useMemo(() => (issues['DONE'] || []).length, [issues])

  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const droppablePrefix = epic ? epic.id : '__no_epic__'

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Swimlane Header */}
      <div className={cn(
        'flex w-full items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700',
        isCollapsed ? 'rounded-xl' : 'rounded-t-xl',
      )}>
        {epic && dragHandleProps && (
          <span
            {...dragHandleProps}
            aria-label="Drag to reorder swimlane"
            className="cursor-grab rounded p-0.5 text-gray-300 hover:bg-gray-200 hover:text-gray-500 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-gray-300 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 shrink-0" />
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand swimlane' : 'Collapse swimlane'}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {isCollapsed
            ? <ChevronRight className="h-4 w-4 shrink-0" />
            : <ChevronDown className="h-4 w-4 shrink-0" />
          }
        </button>
        {epic ? (
          <button
            type="button"
            onClick={() => onEpicClick?.(epic)}
            disabled={!onEpicClick}
            className="flex min-w-0 flex-1 items-center gap-2 rounded text-left transition disabled:cursor-default enabled:hover:opacity-80"
          >
            <span className="text-sm">⚡</span>
            <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{projectKey}-{epic.number}</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{epic.title}</span>
            <UserAvatar user={epic.assignee} size="sm" />
            <span className="text-xs text-gray-400 dark:text-gray-500">({totalCount} work item{totalCount !== 1 ? 's' : ''})</span>
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              STATUS_BADGE_COLORS[epic.status] || 'bg-blue-100 text-blue-700',
            )}>
              {STATUS_LABELS[epic.status] || epic.status}
            </span>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">No Epic</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">({totalCount} work item{totalCount !== 1 ? 's' : ''})</span>
          </div>
        )}
        {/* Mini progress bar */}
        {totalCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{doneCount}/{totalCount}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {epic && (onMoveUp || onMoveDown) && (
          <div className={cn('flex items-center gap-0.5', totalCount === 0 && 'ml-auto')}>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              title="Move swimlane up"
              aria-label="Move swimlane up"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              title="Move swimlane down"
              aria-label="Move swimlane down"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Swimlane Columns */}
      {!isCollapsed && (
        <div
          ref={columnsRef}
          onScroll={(e) => onColumnsScroll?.(e.currentTarget)}
          className="flex gap-0 border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
          {STATUSES.map((status) => {
            const columnIssues = issues[status] || []
            const droppableId = `${droppablePrefix}:${status}`
            return (
              <div key={status} className="flex w-56 shrink-0 flex-col border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
                  <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[status])} />
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{STATUS_LABELS[status] || status}</span>
                  <div className="ml-auto flex items-center gap-1">
                    {columnIssues.length > 0 && (
                      <span className="text-[10px] text-gray-400">{columnIssues.length}</span>
                    )}
                    {onAddClick && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAddClick(status) }}
                        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                <Droppable droppableId={droppableId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'flex-1 space-y-1.5 overflow-y-auto p-1.5',
                        snapshot.isDraggingOver && 'bg-primary-50/50 dark:bg-primary-900/20',
                      )}
                      style={{ minHeight: 48 }}
                    >
                      {columnIssues.map((issue, index) => (
                        <Draggable key={issue.id} draggableId={issue.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(snapshot.isDragging && 'rotate-2 opacity-90')}
                            >
                              <IssueCard
                                issue={issue}
                                projectKey={projectKey}
                                projectId={projectId}
                                onClick={() => onIssueClick(issue)}
                                childIssues={childrenMap.get(issue.id)}
                                isExpanded={expandedIssues.has(issue.id)}
                                onToggleExpand={onToggleExpand}
                                onChildClick={onChildClick}
                                onChildStatusToggle={onChildStatusToggle}
                                compact
                                epics={epics}
                                onEpicChange={onEpicChange}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
