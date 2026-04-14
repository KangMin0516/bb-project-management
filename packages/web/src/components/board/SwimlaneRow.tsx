import { memo, useMemo } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import type { Issue } from '@/api/issues'
import type { ChildIssue } from './types'
import IssueCard from './IssueCard'
import { cn } from '@/lib/utils'
import { STATUSES, STATUS_COLORS, STATUS_LABELS, STATUS_BADGE_COLORS } from '@/lib/constants'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface Props {
  epic: Issue | null
  issues: Record<string, Issue[]>
  projectKey: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  onIssueClick: (issue: Issue) => void
  childrenMap: Map<string, ChildIssue[]>
  expandedIssues: Set<string>
  onToggleExpand: (issueId: string) => void
  onChildClick: (child: ChildIssue) => void
  onChildStatusToggle: (child: ChildIssue) => void
}

export default memo(function SwimlaneRow({
  epic,
  issues,
  projectKey,
  isCollapsed,
  onToggleCollapse,
  onIssueClick,
  childrenMap,
  expandedIssues,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
}: Props) {
  const totalCount = useMemo(() => {
    let count = 0
    for (const arr of Object.values(issues)) count += arr.length
    return count
  }, [issues])

  const doneCount = useMemo(() => (issues['DONE'] || []).length, [issues])

  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const droppablePrefix = epic ? epic.id : '__no_epic__'

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Swimlane Header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        }
        {epic ? (
          <>
            <span className="text-sm">⚡</span>
            <span className="font-mono text-xs text-gray-400">{projectKey}-{epic.number}</span>
            <span className="text-sm font-semibold text-gray-800 truncate">{epic.title}</span>
            <span className="text-xs text-gray-400">({totalCount} work item{totalCount !== 1 ? 's' : ''})</span>
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              STATUS_BADGE_COLORS[epic.status] || 'bg-blue-100 text-blue-700',
            )}>
              {STATUS_LABELS[epic.status] || epic.status}
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-gray-400">No Epic</span>
            <span className="text-xs text-gray-400">({totalCount} work item{totalCount !== 1 ? 's' : ''})</span>
          </>
        )}
        {/* Mini progress bar */}
        {totalCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-gray-400">{doneCount}/{totalCount}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Swimlane Columns */}
      {!isCollapsed && (
        <div className="flex gap-0 border-t border-gray-200 overflow-x-auto">
          {STATUSES.map((status) => {
            const columnIssues = issues[status] || []
            const droppableId = `${droppablePrefix}:${status}`
            return (
              <div key={status} className="flex w-56 shrink-0 flex-col border-r border-gray-100 last:border-r-0">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100">
                  <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[status])} />
                  <span className="text-[11px] font-medium text-gray-500">{STATUS_LABELS[status] || status}</span>
                  {columnIssues.length > 0 && (
                    <span className="ml-auto text-[10px] text-gray-400">{columnIssues.length}</span>
                  )}
                </div>

                <Droppable droppableId={droppableId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'flex-1 space-y-1.5 overflow-y-auto p-1.5',
                        snapshot.isDraggingOver && 'bg-primary-50/50',
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
                                onClick={() => onIssueClick(issue)}
                                childIssues={childrenMap.get(issue.id)}
                                isExpanded={expandedIssues.has(issue.id)}
                                onToggleExpand={onToggleExpand}
                                onChildClick={onChildClick}
                                onChildStatusToggle={onChildStatusToggle}
                                compact
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
