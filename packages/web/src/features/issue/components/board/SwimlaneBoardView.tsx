import { useMemo, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from './types'
import SwimlaneRow from './SwimlaneRow'
import { calculateDropOrder, EPIC_STATUS_ORDER } from '@/shared/config/constants'

interface SwimlaneData {
  epic: Issue | null
  issues: Record<string, Issue[]>
}

interface SwimlaneBoardViewProps {
  board: Record<string, Issue[]>
  projectKey: string
  projectId: string
  onIssueClick: (issue: Issue) => void
  /** Open the Epic detail panel when the swimlane title is clicked. */
  onEpicClick?: (epic: Issue) => void
  onReorder: (issueId: string, status: string, order: number) => void
  onEpicChange?: (issueId: string, newParentId: string | null) => void
  onAddClick?: (status: string) => void
  childrenMap: Map<string, ChildIssue[]>
  expandedIssues: Set<string>
  onToggleExpand: (issueId: string) => void
  onChildClick: (child: ChildIssue) => void
  onChildStatusToggle: (child: ChildIssue) => void
  /** Only show swimlanes whose epic owner is in this set. Empty = no filter. */
  epicOwnersFilter?: Set<string>
  /** Available epics for the inline "change Epic" chip on cards. */
  epics?: Issue[]
  /** Lifted collapse state — toolbar Expand/Collapse all needs to mutate it. */
  collapsedEpics: Set<string>
  onCollapseToggle: (epicId: string | null) => void
  /** Persist the new order when an Epic swimlane is dragged or moved by arrow. */
  onSwimlaneReorder?: (epicId: string, status: string, newOrder: number) => void
}

export default function SwimlaneBoardView({
  board,
  projectKey,
  projectId,
  onIssueClick,
  onEpicClick,
  onReorder,
  onEpicChange,
  onAddClick,
  childrenMap,
  expandedIssues,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
  epicOwnersFilter,
  epics,
  collapsedEpics,
  onCollapseToggle,
  onSwimlaneReorder,
}: SwimlaneBoardViewProps) {
  // Horizontal scroll sync — each SwimlaneRow registers its columns
  // container here so scrolling one mirrors to the others. RAF + a
  // syncing flag prevent feedback loops.
  const scrollContainersRef = useRef<Set<HTMLDivElement>>(new Set())
  const isSyncingRef = useRef(false)

  const onColumnsScroll = useCallback((source: HTMLDivElement) => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    const left = source.scrollLeft
    for (const el of scrollContainersRef.current) {
      if (el !== source && el.scrollLeft !== left) el.scrollLeft = left
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false
    })
  }, [])

  const registerScrollContainer = useCallback((el: HTMLDivElement | null) => {
    if (el) scrollContainersRef.current.add(el)
  }, [])

  const unregisterScrollContainer = useCallback((el: HTMLDivElement) => {
    scrollContainersRef.current.delete(el)
  }, [])
  const { swimlanes } = useMemo(() => {
    const epicMap = new Map<string, Issue>()
    const epicChildren = new Map<string, Record<string, Issue[]>>()
    const noEpicIssues: Record<string, Issue[]> = {}

    // First pass: find all epics
    for (const issues of Object.values(board)) {
      for (const issue of issues) {
        if (issue.type === 'EPIC') epicMap.set(issue.id, issue)
      }
    }

    // Second pass: group non-epic issues by their parent epic
    for (const [status, issues] of Object.entries(board)) {
      for (const issue of issues) {
        if (issue.type === 'EPIC') continue

        const epicId = issue.parentId && epicMap.has(issue.parentId) ? issue.parentId : null

        if (epicId) {
          if (!epicChildren.has(epicId)) epicChildren.set(epicId, {})
          const bucket = epicChildren.get(epicId)!
          if (!bucket[status]) bucket[status] = []
          bucket[status].push(issue)
        } else {
          if (!noEpicIssues[status]) noEpicIssues[status] = []
          noEpicIssues[status].push(issue)
        }
      }
    }

    // Build swimlanes sorted by user-controlled epic.order (primary).
    // EPIC_STATUS_ORDER is the tie-breaker for epics created in different
    // columns that happen to share an `order` value (the per-column gap
    // means duplicates are common pre-drag).
    const lanes: SwimlaneData[] = []

    const epicEntries = [...epicMap.entries()]
    epicEntries.sort((a, b) => {
      const orderA = a[1].order ?? 0
      const orderB = b[1].order ?? 0
      if (orderA !== orderB) return orderA - orderB
      const statusA = EPIC_STATUS_ORDER[a[1].status] ?? 99
      const statusB = EPIC_STATUS_ORDER[b[1].status] ?? 99
      return statusA - statusB
    })

    for (const [epicId, epic] of epicEntries) {
      const children = epicChildren.get(epicId) || {}
      const childCount = Object.values(children).reduce((s, arr) => s + arr.length, 0)
      if (childCount > 0) lanes.push({ epic, issues: children })
    }

    // "No Epic" at the bottom
    const noEpicCount = Object.values(noEpicIssues).reduce((s, arr) => s + arr.length, 0)
    if (noEpicCount > 0) {
      lanes.push({ epic: null, issues: noEpicIssues })
    }

    // Filter by epic owner (swimlane-level). Lanes without an owner —
    // unassigned epics or the "No Epic" bucket — are hidden when the
    // filter is active.
    const filtered = epicOwnersFilter && epicOwnersFilter.size > 0
      ? lanes.filter((l) => l.epic?.assigneeId && epicOwnersFilter.has(l.epic.assigneeId))
      : lanes

    return { swimlanes: filtered }
  }, [board, epicOwnersFilter])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId, type } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    // Swimlane reorder — change Epic.order, keep status the same.
    if (type === 'swimlane') {
      if (!onSwimlaneReorder) return
      const epicId = draggableId.replace(/^swimlane-/, '')
      const epic = swimlanes.find((l) => l.epic?.id === epicId)?.epic
      if (!epic) return
      const epicLanes = swimlanes.filter((l) => l.epic).map((l) => l.epic!) as Issue[]
      const without = epicLanes.filter((e) => e.id !== epicId)
      const newOrder = calculateDropOrder(without, destination.index)
      onSwimlaneReorder(epicId, epic.status, newOrder)
      return
    }

    // Parse droppableId: "{epicId}:{status}"
    const destParts = destination.droppableId.split(':')
    const destStatus = destParts.pop()!
    const destEpicPrefix = destParts.join(':')
    const sourceEpicPrefix = source.droppableId.split(':').slice(0, -1).join(':')

    // Cross-epic drag: update parentId
    if (destEpicPrefix !== sourceEpicPrefix && onEpicChange) {
      const newParentId = destEpicPrefix === '__no_epic__' ? null : destEpicPrefix
      onEpicChange(draggableId, newParentId)
    }

    // Get issues in destination column from the correct swimlane
    const targetLane = swimlanes.find((lane) => {
      const prefix = lane.epic ? lane.epic.id : '__no_epic__'
      return destEpicPrefix === prefix
    })
    const rawIssues = targetLane?.issues[destStatus] || []

    const destIssues = destination.droppableId === source.droppableId
      ? rawIssues.filter(issue => issue.id !== draggableId)
      : rawIssues

    const newOrder = calculateDropOrder(destIssues, destination.index)
    onReorder(draggableId, destStatus, newOrder)
  }, [swimlanes, onReorder, onEpicChange, onSwimlaneReorder])

  // Epic lanes are draggable to reorder; "No Epic" lane stays pinned at the bottom.
  const epicLanes = swimlanes.filter((l) => l.epic)
  const noEpicLane = swimlanes.find((l) => !l.epic)

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="swimlanes-root" type="swimlane">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col gap-3"
          >
            {epicLanes.map((lane, idx) => {
              const key = lane.epic!.id
              const isFirst = idx === 0
              const isLast = idx === epicLanes.length - 1
              const moveLane = (direction: 'up' | 'down') => {
                if (!onSwimlaneReorder) return
                const targetIdx = direction === 'up' ? idx - 1 : idx + 1
                if (targetIdx < 0 || targetIdx >= epicLanes.length) return
                const others = epicLanes.filter((_, i) => i !== idx).map((l) => l.epic!) as Issue[]
                // When moving down, destination index is one past the target; calculateDropOrder slots before it.
                const insertIdx = direction === 'up' ? targetIdx : targetIdx
                const newOrder = calculateDropOrder(others, insertIdx)
                onSwimlaneReorder(lane.epic!.id, lane.epic!.status, newOrder)
              }
              return (
                <Draggable
                  key={key}
                  draggableId={`swimlane-${key}`}
                  index={idx}
                  isDragDisabled={!onSwimlaneReorder}
                >
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={snapshot.isDragging ? 'opacity-90' : undefined}
                    >
                      <SwimlaneRow
                        epic={lane.epic}
                        issues={lane.issues}
                        projectKey={projectKey}
                        projectId={projectId}
                        isCollapsed={collapsedEpics.has(key)}
                        onToggleCollapse={() => onCollapseToggle(key)}
                        onIssueClick={onIssueClick}
                        onEpicClick={onEpicClick}
                        onAddClick={onAddClick}
                        childrenMap={childrenMap}
                        expandedIssues={expandedIssues}
                        onToggleExpand={onToggleExpand}
                        onChildClick={onChildClick}
                        onChildStatusToggle={onChildStatusToggle}
                        epics={epics}
                        onEpicChange={onEpicChange}
                        dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                        onMoveUp={isFirst ? undefined : () => moveLane('up')}
                        onMoveDown={isLast ? undefined : () => moveLane('down')}
                        registerScrollContainer={registerScrollContainer}
                        unregisterScrollContainer={unregisterScrollContainer}
                        onColumnsScroll={onColumnsScroll}
                      />
                    </div>
                  )}
                </Draggable>
              )
            })}
            {provided.placeholder}
            {noEpicLane && (
              <SwimlaneRow
                epic={null}
                issues={noEpicLane.issues}
                projectKey={projectKey}
                projectId={projectId}
                isCollapsed={collapsedEpics.has('__no_epic__')}
                onToggleCollapse={() => onCollapseToggle(null)}
                onIssueClick={onIssueClick}
                onEpicClick={onEpicClick}
                onAddClick={onAddClick}
                childrenMap={childrenMap}
                expandedIssues={expandedIssues}
                onToggleExpand={onToggleExpand}
                onChildClick={onChildClick}
                onChildStatusToggle={onChildStatusToggle}
                epics={epics}
                onEpicChange={onEpicChange}
                registerScrollContainer={registerScrollContainer}
                unregisterScrollContainer={unregisterScrollContainer}
                onColumnsScroll={onColumnsScroll}
              />
            )}
            {swimlanes.length === 0 && (
              <div className="flex h-40 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                No issues found
              </div>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
