import { useMemo, useCallback, useState } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import type { Issue } from '@/api/issues'
import type { ChildIssue } from './types'
import SwimlaneRow from './SwimlaneRow'
import { calculateDropOrder, EPIC_STATUS_ORDER } from '@/lib/constants'

interface SwimlaneData {
  epic: Issue | null
  issues: Record<string, Issue[]>
}

interface SwimlaneBoardViewProps {
  board: Record<string, Issue[]>
  projectKey: string
  onIssueClick: (issue: Issue) => void
  onReorder: (issueId: string, status: string, order: number) => void
  onEpicChange?: (issueId: string, newParentId: string | null) => void
  onAddClick?: (status: string) => void
  childrenMap: Map<string, ChildIssue[]>
  expandedIssues: Set<string>
  onToggleExpand: (issueId: string) => void
  onChildClick: (child: ChildIssue) => void
  onChildStatusToggle: (child: ChildIssue) => void
}

export default function SwimlaneBoardView({
  board,
  projectKey,
  onIssueClick,
  onReorder,
  onEpicChange,
  onAddClick,
  childrenMap,
  expandedIssues,
  onToggleExpand,
  onChildClick,
  onChildStatusToggle,
}: SwimlaneBoardViewProps) {
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())

  const { swimlanes } = useMemo(() => {
    const epicMap = new Map<string, Issue>()
    const epicChildren = new Map<string, Record<string, Issue[]>>()
    let noEpicIssues: Record<string, Issue[]> = {}

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

    // Build swimlanes sorted by epic status priority, then by child count
    const lanes: SwimlaneData[] = []

    const epicEntries = [...epicMap.entries()]
    epicEntries.sort((a, b) => {
      const statusA = EPIC_STATUS_ORDER[a[1].status] ?? 99
      const statusB = EPIC_STATUS_ORDER[b[1].status] ?? 99
      if (statusA !== statusB) return statusA - statusB
      const countA = Object.values(epicChildren.get(a[0]) || {}).reduce((s, arr) => s + arr.length, 0)
      const countB = Object.values(epicChildren.get(b[0]) || {}).reduce((s, arr) => s + arr.length, 0)
      return countB - countA
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

    return { swimlanes: lanes }
  }, [board])

  const toggleCollapse = useCallback((epicId: string | null) => {
    const key = epicId || '__no_epic__'
    setCollapsedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

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
  }, [swimlanes, onReorder, onEpicChange])

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {swimlanes.map((lane) => {
          const key = lane.epic?.id || '__no_epic__'
          return (
            <SwimlaneRow
              key={key}
              epic={lane.epic}
              issues={lane.issues}
              projectKey={projectKey}
              isCollapsed={collapsedEpics.has(key)}
              onToggleCollapse={() => toggleCollapse(lane.epic?.id || null)}
              onIssueClick={onIssueClick}
              onAddClick={onAddClick}
              childrenMap={childrenMap}
              expandedIssues={expandedIssues}
              onToggleExpand={onToggleExpand}
              onChildClick={onChildClick}
              onChildStatusToggle={onChildStatusToggle}
            />
          )
        })}
        {swimlanes.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No issues found
          </div>
        )}
      </div>
    </DragDropContext>
  )
}
