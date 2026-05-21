import { createPortal } from 'react-dom'
import { Droppable, Draggable, type DraggableProvided, type DraggableStateSnapshot } from '@hello-pangea/dnd'
import { CalendarPlus, PanelRightClose, PanelRightOpen, RefreshCw } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '@/entities/user/UserAvatar'
import {
  STATUS_BAR_COLORS,
  TYPE_ICONS,
  PRIORITY_DOT_COLORS,
} from '@/shared/config/constants'
import type { Issue } from '@/features/issue/api'

interface UnscheduledPanelProps {
  items: Issue[]
  isLoading: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onRowClick: (issue: Issue) => void
  onRefresh: () => void
  projectKey: string | undefined
}

export const UNSCHEDULED_DROPPABLE_ID = 'unscheduled'

/**
 * Right-rail companion of the Calendar (PM-58). Lists active tickets
 * with no `dueDate` so the PM can drag them onto a day to schedule.
 *
 * Layout / collapse mirror the Board TOC sidebar — same `PanelRight*`
 * icons, same `transition-[width] duration-200`, same URL persistence
 * pattern (handled by the parent `CalendarPage`).
 *
 * Each row is a `<Draggable>` whose `draggableId = issue.id`; drop
 * targets are the `<Droppable droppableId="day:YYYY-MM-DD">` wrapping
 * each calendar cell. Drop-on-self (back into the unscheduled list) is
 * a no-op for phase 1 — clearing a dueDate by drag isn't supported.
 */
export default function UnscheduledPanel({
  items,
  isLoading,
  collapsed,
  onToggleCollapse,
  onRowClick,
  onRefresh,
  projectKey,
}: UnscheduledPanelProps) {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white transition-[width] duration-200 dark:border-gray-700 dark:bg-gray-800',
        collapsed ? 'w-9' : 'w-72',
      )}
    >
      <header
        className={cn(
          'flex h-10 shrink-0 items-center border-b border-gray-200 dark:border-gray-700',
          collapsed ? 'justify-center' : 'justify-between px-3',
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5 text-primary-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Unscheduled
            </span>
            <span className="text-[10px] text-gray-400">({items.length})</span>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          {!collapsed && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Show unscheduled' : 'Hide unscheduled'}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            {collapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </header>

      <Droppable droppableId={UNSCHEDULED_DROPPABLE_ID} isDropDisabled>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto px-2 py-2"
          >
            {isLoading ? (
              <p className="px-1 py-3 text-[11px] italic text-gray-400">Loading…</p>
            ) : items.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-1">
                {items.map((issue, index) => (
                  <Draggable key={issue.id} draggableId={issue.id} index={index}>
                    {(dragProvided, dragSnapshot) => {
                      const row = renderRow(issue, dragProvided, dragSnapshot, onRowClick, projectKey)
                      // While dragging, render the clone in a portal at
                      // document.body so the panel's `overflow-hidden`
                      // (needed for the width transition) doesn't clip it.
                      return dragSnapshot.isDragging
                        ? createPortal(row, document.body)
                        : row
                    }}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </div>
        )}
      </Droppable>
    </aside>
  )
}

function renderRow(
  issue: Issue,
  dragProvided: DraggableProvided,
  dragSnapshot: DraggableStateSnapshot,
  onRowClick: (i: Issue) => void,
  projectKey: string | undefined,
) {
  return (
    <li
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      role="button"
      tabIndex={0}
      onClick={() => onRowClick(issue)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick(issue)
        }
      }}
      className={cn(
        'group flex cursor-grab flex-col items-start gap-1 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-sm outline-none transition-shadow dark:border-gray-700 dark:bg-gray-900',
        'focus-visible:ring-2 focus-visible:ring-primary-500',
        dragSnapshot.isDragging
          ? 'cursor-grabbing shadow-lg ring-1 ring-primary-300'
          : 'hover:border-primary-300 hover:shadow-md dark:hover:border-primary-700',
      )}
    >
      <div className="flex w-full items-center gap-1">
        <GripIcon />
        <span
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            STATUS_BAR_COLORS[issue.status] ?? 'bg-gray-300',
          )}
          title={issue.status.replace('_', ' ')}
        />
        <span className="shrink-0 text-xs leading-none">
          {TYPE_ICONS[issue.type] ?? '📋'}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-gray-400">
          {projectKey ? `${projectKey}-${issue.number}` : `#${issue.number}`}
        </span>
        <span
          className={cn(
            'ml-auto inline-block h-1.5 w-1.5 shrink-0 rounded-full',
            PRIORITY_DOT_COLORS[issue.priority] ?? 'bg-gray-300',
          )}
          title={issue.priority}
        />
        {issue.assignee ? <UserAvatar user={issue.assignee} size="xs" /> : null}
      </div>
      <span className="line-clamp-2 text-[11px] text-gray-800 dark:text-gray-100">
        {issue.title}
      </span>
    </li>
  )
}

function GripIcon() {
  return (
    <span
      aria-hidden
      className="select-none text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
      title="Drag to schedule"
    >
      ⋮⋮
    </span>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto flex flex-col items-center gap-1.5 px-3 py-8 text-center">
      <CalendarPlus className="h-5 w-5 text-gray-400" />
      <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
        Everything scheduled
      </p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        Active tickets with no due date will appear here.
      </p>
    </div>
  )
}
