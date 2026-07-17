import { useCallback, useMemo, useState } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvidedDragHandleProps,
} from '@hello-pangea/dnd'
import { ChevronRight, FolderOpen, GripVertical, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import UserAvatar from '@/entities/user/UserAvatar'
import { STATUS_BAR_COLORS, TYPE_ICONS, calculateDropOrder } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import type { Issue, TableOfContent } from '@/features/issue/api'
import type { ChildIssue } from '@/features/issue/components/board/types'

interface BoardTocSidebarProps {
  /** Project Module → Epic outline (from GET /issues/table-of-content). */
  toc: TableOfContent | undefined
  /** Epics currently on the board — gives us assignee + parentId for the TOC rows. */
  boardEpics: Issue[]
  /** Every non-EPIC issue on the board (TASK / BUG, sub-tasks excluded). */
  taskish: Issue[]
  /** Sub-tasks indexed by their Task/Bug parentId (same map the swimlane view uses). */
  childrenMap: Map<string, ChildIssue[]>
  /** All board issues by id — needed to resolve a sub-task click into a full Issue. */
  allIssuesById: Map<string, Issue>
  /** Open the IssueDetailPanel for any clicked TOC row (Module / Epic / Task / Sub-task). */
  onIssueClick: (issue: Issue) => void
  /**
   * Drag-reorder a Module or an Epic. Same generic `/reorder` endpoint the
   * board's kanban and swimlane drags already use (status is passed through
   * unchanged — only `order` moves), so the board and this sidebar always
   * agree on ordering without any extra sync step.
   */
  onReorder: (issueId: string, status: string, order: number) => void
  /** Persisted collapse state — toggled via the header chevron. */
  collapsed: boolean
  onToggleCollapse: () => void
}

/**
 * Left-rail outline for the Board page. Reads `tocApi.findTableOfContent`
 * for the Module → Epic skeleton, then enriches each Epic with its
 * Task/Bug children from the board payload (no extra API call).
 *
 * Click semantics: any row opens the corresponding issue's detail panel.
 * Module headers and Epic rows additionally toggle their expand state.
 * Status is rendered as a coloured dot (see `STATUS_BAR_COLORS`); the
 * assignee is just an avatar — no name, no email — to keep the rail
 * dense even for projects with 30+ epics.
 *
 * Width animates via `transition-[width]` to match the global AppLayout
 * sidebar; per-node expand/collapse uses a rotate-90 chevron animation
 * so the eye can follow which node toggled.
 */
export default function BoardTocSidebar({
  toc,
  boardEpics,
  taskish,
  childrenMap,
  allIssuesById,
  onIssueClick,
  onReorder,
  collapsed,
  onToggleCollapse,
}: BoardTocSidebarProps) {
  const epicById = useMemo(() => {
    const map = new Map<string, Issue>()
    for (const e of boardEpics) map.set(e.id, e)
    return map
  }, [boardEpics])

  const tasksByEpicId = useMemo(() => {
    const map = new Map<string, Issue[]>()
    for (const t of taskish) {
      if (t.type === 'EPIC' || t.type === 'DOMAIN') continue
      if (!t.parentId) continue
      const list = map.get(t.parentId) ?? []
      list.push(t)
      map.set(t.parentId, list)
    }
    return map
  }, [taskish])

  const modules = useMemo(() => toc?.domains ?? [], [toc])
  const orphans = useMemo(() => toc?.orphanEpics ?? [], [toc])
  const hasContent = modules.length > 0 || orphans.length > 0

  // Modules reorder among themselves; Epics reorder within their own
  // Module (or the Unassigned bucket) — dragging one to a *different*
  // bucket would silently reparent it, which is a bigger, separate action
  // (see bulk-set-parent) so cross-bucket drops are rejected, not applied.
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId, type } = result
      if (!destination) return
      if (destination.droppableId === source.droppableId && destination.index === source.index) return

      if (type === 'toc-module') {
        const domainId = draggableId.replace(/^toc-module-/, '')
        const domainIssue = allIssuesById.get(domainId)
        if (!domainIssue) return
        const siblings = modules
          .map((m) => allIssuesById.get(m.id))
          .filter((i): i is Issue => !!i && i.id !== domainId)
        const newOrder = calculateDropOrder(siblings, destination.index)
        onReorder(domainId, domainIssue.status, newOrder)
        return
      }

      if (type === 'toc-epic') {
        if (destination.droppableId !== source.droppableId) return
        const epicId = draggableId.replace(/^toc-epic-/, '')
        const epicIssue = epicById.get(epicId)
        if (!epicIssue) return
        const bucketId = source.droppableId.replace(/^toc-epics-/, '')
        const bucketEpics =
          bucketId === 'unassigned' ? orphans : (modules.find((m) => m.id === bucketId)?.epics ?? [])
        const siblings = bucketEpics
          .map((e) => epicById.get(e.id))
          .filter((i): i is Issue => !!i && i.id !== epicId)
        const newOrder = calculateDropOrder(siblings, destination.index)
        onReorder(epicId, epicIssue.status, newOrder)
      }
    },
    [modules, orphans, allIssuesById, epicById, onReorder],
  )

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 dark:border-gray-700 dark:bg-gray-800',
        collapsed ? 'w-9' : 'w-64',
      )}
    >
      <header
        className={cn(
          'flex h-8 shrink-0 items-center',
          collapsed ? 'justify-center' : 'justify-between px-3 pt-2',
        )}
      >
        {!collapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Contents
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Show table of content' : 'Hide table of content'}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </header>

      {/* The inner list is wrapped in a width-locked div so the
          surrounding aside's width animation doesn't squeeze the rows
          to ugly intermediate widths during the transition. The aside
          clips via overflow-hidden so it just slides off-screen. */}
      <div className="w-64 flex-1 overflow-y-auto px-1 py-2 text-xs">
        {!hasContent ? (
          <p className="px-2 py-3 text-[11px] italic text-gray-400">
            No modules or epics yet.
          </p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="toc-modules" type="toc-module">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {modules.map((m, idx) => (
                    <Draggable key={m.id} draggableId={`toc-module-${m.id}`} index={idx}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={snapshot.isDragging ? 'opacity-90' : undefined}
                        >
                          <ModuleNode
                            module={m}
                            epicById={epicById}
                            tasksByEpicId={tasksByEpicId}
                            childrenMap={childrenMap}
                            allIssuesById={allIssuesById}
                            onIssueClick={onIssueClick}
                            dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            {orphans.length > 0 && (
              <UnassignedNode
                epics={orphans}
                epicById={epicById}
                tasksByEpicId={tasksByEpicId}
                childrenMap={childrenMap}
                allIssuesById={allIssuesById}
                onIssueClick={onIssueClick}
              />
            )}
          </DragDropContext>
        )}
      </div>
    </aside>
  )
}

interface ModuleNodeProps {
  module: { id: string; title: string; epics: Array<{ id: string; title: string; status: string }> }
  epicById: Map<string, Issue>
  tasksByEpicId: Map<string, Issue[]>
  childrenMap: Map<string, ChildIssue[]>
  allIssuesById: Map<string, Issue>
  onIssueClick: (issue: Issue) => void
  dragHandleProps?: DraggableProvidedDragHandleProps
}

function ModuleNode({
  module: mod,
  epicById,
  tasksByEpicId,
  childrenMap,
  allIssuesById,
  onIssueClick,
  dragHandleProps,
}: ModuleNodeProps) {
  const [open, setOpen] = useState(true)
  // DOMAINs are still Issue rows — `allIssuesById` picks them up from
  // the board response (they have a default BACKLOG status). Click the
  // title → open the same IssueDetailPanel as Epic / Task / Sub-task.
  const fullModule = allIssuesById.get(mod.id)

  return (
    <div className="mb-1">
      <div className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            aria-label="Drag to reorder"
            className="shrink-0 cursor-grab rounded p-0.5 text-gray-300 hover:bg-gray-200 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300"
          >
            <GripVertical className="h-3 w-3" />
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <ChevronRight
            className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-90')}
          />
        </button>
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <button
          type="button"
          onClick={() => fullModule && onIssueClick(fullModule)}
          disabled={!fullModule}
          title={mod.title}
          className="flex-1 truncate text-left font-semibold hover:text-primary-600 disabled:cursor-default disabled:hover:text-gray-700 dark:disabled:hover:text-gray-200"
        >
          {mod.title}
        </button>
        <span className="ml-auto shrink-0 text-[10px] text-gray-400">{mod.epics.length}</span>
      </div>

      <ul
        className={cn(
          'ml-3 grid border-l border-gray-200 transition-[grid-template-rows] duration-200 ease-in-out dark:border-gray-700',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <li className="overflow-hidden">
          <Droppable droppableId={`toc-epics-${mod.id}`} type="toc-epic">
            {(provided) => (
              <ul ref={provided.innerRef} {...provided.droppableProps}>
                {mod.epics.map((e, idx) => (
                  <Draggable key={e.id} draggableId={`toc-epic-${e.id}`} index={idx}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={snapshot.isDragging ? 'opacity-90' : undefined}
                      >
                        <EpicNode
                          epicSummary={e}
                          epicIssue={epicById.get(e.id)}
                          tasks={tasksByEpicId.get(e.id) ?? []}
                          childrenMap={childrenMap}
                          allIssuesById={allIssuesById}
                          onIssueClick={onIssueClick}
                          dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </li>
      </ul>
    </div>
  )
}

interface UnassignedNodeProps {
  epics: Array<{ id: string; title: string; status: string }>
  epicById: Map<string, Issue>
  tasksByEpicId: Map<string, Issue[]>
  childrenMap: Map<string, ChildIssue[]>
  allIssuesById: Map<string, Issue>
  onIssueClick: (issue: Issue) => void
}

function UnassignedNode({ epics, epicById, tasksByEpicId, childrenMap, allIssuesById, onIssueClick }: UnassignedNodeProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-1 mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
      >
        <ChevronRight
          className={cn('h-3 w-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
        />
        <span className="truncate font-semibold">Unassigned</span>
        <span className="ml-auto shrink-0 text-[10px] text-amber-600/80 dark:text-amber-400/80">{epics.length}</span>
      </button>
      <ul
        className={cn(
          'ml-3 grid border-l border-amber-200 transition-[grid-template-rows] duration-200 ease-in-out dark:border-amber-800',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <li className="overflow-hidden">
          <Droppable droppableId="toc-epics-unassigned" type="toc-epic">
            {(provided) => (
              <ul ref={provided.innerRef} {...provided.droppableProps}>
                {epics.map((e, idx) => (
                  <Draggable key={e.id} draggableId={`toc-epic-${e.id}`} index={idx}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={snapshot.isDragging ? 'opacity-90' : undefined}
                      >
                        <EpicNode
                          epicSummary={e}
                          epicIssue={epicById.get(e.id)}
                          tasks={tasksByEpicId.get(e.id) ?? []}
                          childrenMap={childrenMap}
                          allIssuesById={allIssuesById}
                          onIssueClick={onIssueClick}
                          dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </li>
      </ul>
    </div>
  )
}

interface EpicNodeProps {
  epicSummary: { id: string; title: string; status: string }
  /** Full Issue from the board — supplies assignee + lets us open detail. */
  epicIssue: Issue | undefined
  tasks: Issue[]
  childrenMap: Map<string, ChildIssue[]>
  allIssuesById: Map<string, Issue>
  onIssueClick: (issue: Issue) => void
  dragHandleProps?: DraggableProvidedDragHandleProps
}

function EpicNode({
  epicSummary,
  epicIssue,
  tasks,
  childrenMap,
  allIssuesById,
  onIssueClick,
  dragHandleProps,
}: EpicNodeProps) {
  const [open, setOpen] = useState(false)
  const hasTasks = tasks.length > 0

  return (
    <li className="my-0.5">
      <div className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            aria-label="Drag to reorder"
            className="shrink-0 cursor-grab rounded p-0.5 text-gray-300 hover:bg-gray-200 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300"
          >
            <GripVertical className="h-3 w-3" />
          </span>
        )}
        {hasTasks ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="inline-block h-3 w-3 shrink-0" />
        )}
        <StatusDot status={epicSummary.status} />
        <span className="shrink-0 text-xs leading-none">{TYPE_ICONS.EPIC}</span>
        <button
          type="button"
          onClick={() => epicIssue && onIssueClick(epicIssue)}
          disabled={!epicIssue}
          title={epicSummary.title}
          className="flex-1 truncate text-left text-gray-800 hover:text-primary-600 disabled:cursor-default disabled:hover:text-gray-800 dark:text-gray-100 dark:disabled:hover:text-gray-100"
        >
          {epicSummary.title}
        </button>
        {hasTasks ? (
          <span className="shrink-0 text-[10px] text-gray-400">{tasks.length}</span>
        ) : null}
        {epicIssue?.assignee ? (
          <UserAvatar user={epicIssue.assignee} size="xs" />
        ) : null}
      </div>

      {hasTasks ? (
        <ul
          className={cn(
            'ml-4 grid border-l border-gray-200 transition-[grid-template-rows] duration-200 ease-in-out dark:border-gray-700',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <li className="overflow-hidden">
            <ul>
              {tasks.map((t) => (
                <TaskNode
                  key={t.id}
                  task={t}
                  subtasks={childrenMap.get(t.id) ?? []}
                  allIssuesById={allIssuesById}
                  onIssueClick={onIssueClick}
                />
              ))}
            </ul>
          </li>
        </ul>
      ) : null}
    </li>
  )
}

interface TaskNodeProps {
  task: Issue
  subtasks: ChildIssue[]
  allIssuesById: Map<string, Issue>
  onIssueClick: (i: Issue) => void
}

function TaskNode({ task, subtasks, allIssuesById, onIssueClick }: TaskNodeProps) {
  const [open, setOpen] = useState(false)
  const hasSubtasks = subtasks.length > 0

  return (
    <li className="my-0.5">
      <div className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700">
        {hasSubtasks ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="inline-block h-3 w-3 shrink-0" />
        )}
        <StatusDot status={task.status} />
        <span className="shrink-0 text-xs leading-none">{TYPE_ICONS[task.type] ?? ''}</span>
        <button
          type="button"
          onClick={() => onIssueClick(task)}
          title={task.title}
          className="flex-1 truncate text-left text-gray-700 hover:text-primary-600 dark:text-gray-300"
        >
          {task.title}
        </button>
        {task.assignee ? <UserAvatar user={task.assignee} size="xs" /> : null}
      </div>

      {hasSubtasks ? (
        <ul
          className={cn(
            'ml-4 grid border-l border-gray-200 transition-[grid-template-rows] duration-200 ease-in-out dark:border-gray-700',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <li className="overflow-hidden">
            <ul>
              {subtasks.map((s) => (
                <SubtaskNode
                  key={s.id}
                  subtask={s}
                  allIssuesById={allIssuesById}
                  onIssueClick={onIssueClick}
                />
              ))}
            </ul>
          </li>
        </ul>
      ) : null}
    </li>
  )
}

interface SubtaskNodeProps {
  subtask: ChildIssue
  /** Sub-tasks aren't in `taskish` — look up the full Issue here so click → detail works. */
  allIssuesById: Map<string, Issue>
  onIssueClick: (i: Issue) => void
}

function SubtaskNode({ subtask, allIssuesById, onIssueClick }: SubtaskNodeProps) {
  const fullIssue = allIssuesById.get(subtask.id)
  return (
    <li>
      <button
        type="button"
        onClick={() => fullIssue && onIssueClick(fullIssue)}
        disabled={!fullIssue}
        title={subtask.title}
        className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left hover:bg-gray-100 disabled:cursor-default dark:hover:bg-gray-700"
      >
        <span className="inline-block h-3 w-3 shrink-0" />
        <StatusDot status={subtask.status} />
        <span className="shrink-0 text-xs leading-none">{TYPE_ICONS.SUB_TASK}</span>
        <span className="flex-1 truncate text-gray-600 dark:text-gray-400">{subtask.title}</span>
        {subtask.assignee ? <UserAvatar user={subtask.assignee} size="xs" /> : null}
      </button>
    </li>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      title={status.replace('_', ' ')}
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        STATUS_BAR_COLORS[status] ?? 'bg-gray-300',
      )}
    />
  )
}
