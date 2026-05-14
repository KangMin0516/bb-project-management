import { useCallback, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { getBool, setBool, PARAM } from '@/shared/lib/filter-codec'
import { STATUSES, calculateDropOrder } from '@/shared/config/constants'
import { useBoardData } from '@/features/issue/hooks/useBoardData'
import { useBoardMutations } from '@/features/issue/hooks/useBoardMutations'
import { useBoardDerivations } from '@/features/issue/hooks/useBoardDerivations'
import { useBoardKeyboardNav } from '@/features/issue/hooks/useBoardKeyboardNav'
import { useOpenIssueFromUrl } from '@/features/issue/hooks/useOpenIssueFromUrl'
import { filterBoard } from '@/features/issue/lib/boardFilter'
import { hasActiveFilters, toggleSet } from '@/shared/ui/filterState'
import BoardColumn from '@/features/issue/components/board/BoardColumn'
import SwimlaneBoardView from '@/features/issue/components/board/SwimlaneBoardView'
import BoardToolbar from '@/features/issue/components/board/BoardToolbar'
import CreateIssueModal from '@/features/issue/components/CreateIssueModal'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from '@/features/issue/components/board/types'

/**
 * Composition root for the project Kanban board. All derivations, queries,
 * mutations, and keyboard navigation live in hooks; the page itself just
 * wires them to the toolbar + column layout (or swimlane view).
 */
export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, setFilters, resetFilters } = useFilterSearchParams()
  const [createModal, setCreateModal] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())
  // Lifted so the toolbar's Expand all / Collapse all can mutate it.
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((epicId: string | null) => {
    const key = epicId || '__no_epic__'
    setCollapsedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  // swimlane defaults to true; explicit '0' opts out.
  const groupByEpic = !searchParams.has(PARAM.swimlane) ? true : getBool(searchParams, PARAM.swimlane, true)
  const showArchived = getBool(searchParams, PARAM.archived, false)

  const mutateParams = useCallback(
    (mutator: (p: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutator(next)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setShowArchived = useCallback(
    (value: boolean) => mutateParams((p) => setBool(p, PARAM.archived, value, false)),
    [mutateParams],
  )
  const setGroupByEpic = useCallback(
    (value: boolean) => mutateParams((p) => setBool(p, PARAM.swimlane, value, true)),
    [mutateParams],
  )

  const { project, board, isLoading } = useBoardData(projectId ?? '', showArchived)
  const { reorder, updateIssue } = useBoardMutations(projectId ?? '')
  const {
    allIssuesById,
    childrenMap,
    parentOnlyBoard,
    assignedMembers,
    boardLabels,
    boardComponents,
    boardEpics,
    flatBoardIssues,
  } = useBoardDerivations(board)

  const expandAllSwimlanes = useCallback(() => setCollapsedEpics(new Set()), [])
  const collapseAllSwimlanes = useCallback(() => {
    const keys = boardEpics.map((e) => e.id)
    keys.push('__no_epic__')
    setCollapsedEpics(new Set(keys))
  }, [boardEpics])

  // Unique Epic owners (epic.assignee) for the Epic Owner filter chip.
  const epicOwners = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; avatar: string | null }>()
    for (const ep of boardEpics) {
      if (ep.assignee && !seen.has(ep.assignee.id)) {
        seen.set(ep.assignee.id, ep.assignee)
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [boardEpics])

  // ?open= deep-link: opens the detail panel when the issue is on the board.
  const allBoardIssues = useMemo(() => (board ? Object.values(board).flat() : undefined), [board])
  useOpenIssueFromUrl(allBoardIssues, setSelectedIssue, { showNotFound: true })

  const { focusedIssueId } = useBoardKeyboardNav({
    flatBoardIssues,
    onOpenIssue: setSelectedIssue,
    isDetailOpen: !!selectedIssue,
  })

  const hasFilters = hasActiveFilters(filters)

  const filteredBoard = useMemo(
    () => (hasFilters ? filterBoard(parentOnlyBoard, filters, { childrenMap }) : parentOnlyBoard),
    [parentOnlyBoard, hasFilters, filters, childrenMap],
  )

  // Use parentOnlyBoard (sub-tasks excluded) so they stop double-rendering
  // as standalone cards in the "No Epic" lane while still appearing nested
  // under their parent Task via childrenMap.
  const filteredBoardForSwimlane = useMemo(() => {
    if (!groupByEpic) return null
    if (!hasFilters) return parentOnlyBoard
    return filterBoard(parentOnlyBoard, filters, { keepEpics: true, childrenMap })
  }, [groupByEpic, parentOnlyBoard, hasFilters, filters, childrenMap])

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const destStatus = destination.droppableId
    const rawIssues = parentOnlyBoard?.[destStatus] ?? []
    const destIssues =
      destination.droppableId === source.droppableId
        ? rawIssues.filter((issue) => issue.id !== draggableId)
        : rawIssues

    const newOrder = calculateDropOrder(destIssues, destination.index)
    reorder.mutate({ issueId: draggableId, status: destStatus, order: newOrder })
  }

  const toggleExpand = useCallback((issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev)
      if (next.has(issueId)) next.delete(issueId); else next.add(issueId)
      return next
    })
  }, [])

  const openChild = useCallback(
    (child: ChildIssue) => {
      const found = allIssuesById.get(child.id)
      if (found) setSelectedIssue(found)
    },
    [allIssuesById],
  )

  const toggleChildStatus = useCallback(
    (child: ChildIssue) => {
      const next = child.status === 'DONE' ? 'TODO' : 'DONE'
      updateIssue.mutate({ issueId: child.id, data: { status: next } })
    },
    [updateIssue],
  )

  if (!projectId) return null

  const projectKey = project?.key ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{projectKey} Board</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
        </div>
        <BoardToolbar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          toggleAssignee={(id) => setFilters({ assignees: toggleSet(filters.assignees, id) })}
          toggleLabel={(id) => setFilters({ labels: toggleSet(filters.labels, id) })}
          toggleComponent={(id) => setFilters({ components: toggleSet(filters.components, id) })}
          setEpicId={(id) => setFilters({ epicId: id })}
          toggleEpicOwner={(id) => setFilters({ epicOwners: toggleSet(filters.epicOwners, id) })}
          assignedMembers={assignedMembers}
          boardLabels={boardLabels}
          boardComponents={boardComponents}
          boardEpics={boardEpics}
          epicOwners={epicOwners}
          hasFilters={hasFilters}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          groupByEpic={groupByEpic}
          setGroupByEpic={setGroupByEpic}
          onExpandAll={expandAllSwimlanes}
          onCollapseAll={collapseAllSwimlanes}
        />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : groupByEpic ? (
          <SwimlaneBoardView
            board={filteredBoardForSwimlane || {}}
            projectKey={projectKey}
            projectId={projectId}
            onIssueClick={setSelectedIssue}
            onEpicClick={setSelectedIssue}
            onReorder={(issueId, status, order) => reorder.mutate({ issueId, status, order })}
            onSwimlaneReorder={(epicId, status, order) => reorder.mutate({ issueId: epicId, status, order })}
            onEpicChange={(issueId, newParentId) => updateIssue.mutate({ issueId, data: { parentId: newParentId } })}
            onAddClick={setCreateModal}
            childrenMap={childrenMap}
            expandedIssues={expandedIssues}
            onToggleExpand={toggleExpand}
            onChildClick={openChild}
            onChildStatusToggle={toggleChildStatus}
            epicOwnersFilter={filters.epicOwners}
            epics={boardEpics}
            collapsedEpics={collapsedEpics}
            onCollapseToggle={toggleCollapse}
          />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4">
              {STATUSES.map((status) => (
                <BoardColumn
                  key={status}
                  status={status}
                  issues={filteredBoard?.[status] || []}
                  projectKey={projectKey}
                  projectId={projectId}
                  onIssueClick={setSelectedIssue}
                  onAddClick={setCreateModal}
                  childrenMap={childrenMap}
                  expandedIssues={expandedIssues}
                  onToggleExpand={toggleExpand}
                  onChildClick={openChild}
                  onChildStatusToggle={toggleChildStatus}
                  focusedIssueId={focusedIssueId}
                  epics={boardEpics}
                  onEpicChange={(issueId, newParentId) => updateIssue.mutate({ issueId, data: { parentId: newParentId } })}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {createModal && (
        <CreateIssueModal projectId={projectId} defaultStatus={createModal} onClose={() => setCreateModal(null)} />
      )}

      {selectedIssue && (
        <IssueDetailPanel
          projectId={projectId}
          projectKey={projectKey}
          issue={selectedIssue}
          context="board"
          onClose={() => setSelectedIssue(null)}
          onNavigate={setSelectedIssue}
        />
      )}
    </div>
  )
}
