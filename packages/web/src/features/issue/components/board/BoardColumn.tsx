import { memo } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from './types'
import IssueCard from './IssueCard'
import { cn } from '@/shared/lib/utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/shared/config/constants'

interface BoardColumnProps {
  status: string
  issues: Issue[]
  projectKey: string
  projectId: string
  onIssueClick: (issue: Issue) => void
  /** `parentId` is null on the plain board (no swimlane context). */
  onAddClick: (status: string, parentId: string | null) => void
  childrenMap?: Map<string, ChildIssue[]>
  expandedIssues?: Set<string>
  onToggleExpand?: (issueId: string) => void
  onChildClick?: (child: ChildIssue) => void
  onChildStatusToggle?: (child: ChildIssue) => void
  focusedIssueId?: string | null
  epics?: Issue[]
  onEpicChange?: (issueId: string, newParentId: string | null) => void
}

export default memo(function BoardColumn({
  status,
  issues,
  projectKey,
  projectId,
  onIssueClick,
  onAddClick,
  childrenMap,
  expandedIssues,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
  focusedIssueId,
  epics,
  onEpicChange,
}: BoardColumnProps) {
  return (
    <div className="flex h-full min-w-[240px] flex-1 flex-col rounded-xl bg-gray-100 dark:bg-gray-800">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[status])} />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{STATUS_LABELS[status] || status}</span>
        <button
          type="button"
          onClick={() => onAddClick(status, null)}
          aria-label={`Add issue to ${STATUS_LABELS[status] || status}`}
          className="rounded-md p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
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
              snapshot.isDraggingOver && 'bg-primary-50/50 dark:bg-primary-900/20',
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
                      projectId={projectId}
                      onClick={() => onIssueClick(issue)}
                      childIssues={childrenMap?.get(issue.id)}
                      isExpanded={expandedIssues?.has(issue.id)}
                      onToggleExpand={onToggleExpand}
                      onChildClick={onChildClick}
                      onChildStatusToggle={onChildStatusToggle}
                      isFocused={focusedIssueId === issue.id}
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
})
