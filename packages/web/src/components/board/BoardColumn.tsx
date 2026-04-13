import { memo } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import type { Issue } from '@/api/issues'
import type { ChildIssue } from './types'
import IssueCard from './IssueCard'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'

interface Props {
  status: string
  issues: Issue[]
  projectKey: string
  onIssueClick: (issue: Issue) => void
  onAddClick: (status: string) => void
  childrenMap?: Map<string, ChildIssue[]>
  expandedIssues?: Set<string>
  onToggleExpand?: (issueId: string) => void
  onChildClick?: (child: ChildIssue) => void
  onChildStatusToggle?: (child: ChildIssue) => void
}

export default memo(function BoardColumn({
  status,
  issues,
  projectKey,
  onIssueClick,
  onAddClick,
  childrenMap,
  expandedIssues,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
}: Props) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-gray-100">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[status])} />
        <span className="text-sm font-semibold text-gray-700">{STATUS_LABELS[status] || status}</span>
        <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
          {issues.length}
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 space-y-2 overflow-y-auto px-2 pb-2',
              snapshot.isDraggingOver && 'bg-primary-50/50',
            )}
            style={{ minHeight: 60 }}
          >
            {issues.map((issue, index) => (
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
                      childIssues={childrenMap?.get(issue.id)}
                      isExpanded={expandedIssues?.has(issue.id)}
                      onToggleExpand={onToggleExpand}
                      onChildClick={onChildClick}
                      onChildStatusToggle={onChildStatusToggle}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <button
        onClick={() => onAddClick(status)}
        className="m-2 rounded-lg border border-dashed border-gray-300 py-1.5 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600"
      >
        + Add issue
      </button>
    </div>
  )
})
