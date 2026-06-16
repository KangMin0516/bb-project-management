import { useCallback, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { useDragScroll } from '@/shared/lib/useDragScroll'
import { getBool, setBool, PARAM } from '@/shared/lib/filter-codec'
import { issueRepository } from '@/features/issue/repository'
import { BOARD_COLUMN_ORDER, calculateDropOrder } from '@/shared/config/constants'
import { useBoardData } from '@/features/issue/hooks/useBoardData'
import { useBoardMutations } from '@/features/issue/hooks/useBoardMutations'
import { useBoardDerivations } from '@/features/issue/hooks/useBoardDerivations'
import { useBoardKeyboardNav } from '@/features/issue/hooks/useBoardKeyboardNav'
import { useOpenIssueFromUrl } from '@/features/issue/hooks/useOpenIssueFromUrl'
import { filterBoard } from '@/features/issue/lib/boardFilter'
import { hasActiveFilters, toggleSet } from '@/shared/ui/filterState'
import { useAuthStore } from '@/features/auth/store'
import {
  applyParsedSearch,
  hasOperators,
  parseSearchQuery,
} from '@/shared/lib/search-query'
import BoardColumn from '@/features/issue/components/board/BoardColumn'
import BoardTocSidebar from '@/features/issue/components/board/BoardTocSidebar'
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
  // `{status, parentId}` instead of just status so the "+" on a swimlane
  // can pre-fill Parent Issue in the Create dialog (PM-42).
  const [createModal, setCreateModal] = useState<{ status: string; parentId: string | null } | null>(null)
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
  const showSubtasks = getBool(searchParams, 'subtasks', false)
  // TOC sidebar opens by default; ?toc=0 in the URL collapses it.
  const tocOpen = !searchParams.has('toc') ? true : getBool(searchParams, 'toc', true)

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
  const setShowSubtasks = useCallback(
    (value: boolean) => mutateParams((p) => setBool(p, 'subtasks', value, false)),
    [mutateParams],
  )

  /**
   * In Group: Epic mode, clicking an Epic in the TOC sidebar should jump
   * to its swimlane on the board instead of opening the detail panel —
   * scanning the board is the primary task and the panel is one click
   * away (via the swimlane title) if the user wants details. In flat
   * mode there's no swimlane to scroll to, so fall back to the panel.
   * Non-EPIC clicks (Tasks / Sub-tasks / Modules) always open the panel.
   */
  const handleTocClick = useCallback(
    (issue: Issue) => {
      if (groupByEpic && issue.type === 'EPIC') {
        // Auto-expand the lane in case it was collapsed — scrollIntoView
        // would land on a closed header otherwise.
        setCollapsedEpics((prev) => {
          if (!prev.has(issue.id)) return prev
          const next = new Set(prev)
          next.delete(issue.id)
          return next
        })
        // Defer the scroll so the (potential) re-expand has rendered.
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-swimlane-id="${issue.id}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        return
      }
      setSelectedIssue(issue)
    },
    [groupByEpic],
  )
  const toggleTocOpen = useCallback(
    () => mutateParams((p) => setBool(p, 'toc', !tocOpen, true)),
    [mutateParams, tocOpen],
  )

  const dragScrollRef = useDragScroll<HTMLDivElement>()

  const sortParam = useMemo(
    () => (filters.sortStack.length ? filters.sortStack.map((r) => `${r.field}:${r.dir}`).join(',') : undefined),
    [filters.sortStack],
  )
  const sortActive = filters.sortStack.length > 0

  const { project, board, isLoading } = useBoardData(projectId ?? '', showArchived, sortParam)
  const { reorder, updateIssue } = useBoardMutations(projectId ?? '')
  const projectKey = project?.key ?? ''

  // PM-110: a free-text search must be able to find sub-tasks too. Sub-tasks
  // are excluded from `parentOnlyBoard` by default, so surface them as cards
  // (same mechanism as the Sub-tasks toggle) whenever the user is searching.
  const searchActive = filters.search.trim().length > 0

  // Module list for the Domain filter chip. Cheap query — the TOC
  // endpoint is small (only DOMAIN + EPIC rows).
  const { data: toc } = useQuery({
    queryKey: ['toc', projectId],
    queryFn: () => issueRepository.findTableOfContent(projectId!),
    enabled: !!projectId,
  })
  const boardModules = useMemo(
    () => toc?.domains.map((d) => ({ id: d.id, title: d.title })) ?? [],
    [toc],
  )

  // Archived toggle is a view switch (matches Lists page semantics):
  //   off → server already excludes archived
  //   on  → keep only archived issues for display
  const viewBoard = useMemo(() => {
    if (!board || !showArchived) return board
    const out: Record<string, Issue[]> = {}
    for (const [status, issues] of Object.entries(board)) {
      out[status] = issues.filter((i) => i.archivedAt != null)
    }
    return out
  }, [board, showArchived])

  const {
    allIssuesById,
    childrenMap,
    parentOnlyBoard,
    epicAncestorMap,
    assignedMembers,
    boardReviewers,
    boardCreators,
    boardLabels,
    boardComponents,
    boardEpics,
    flatBoardIssues,
  } = useBoardDerivations(viewBoard, { includeSubtasks: showSubtasks || searchActive })

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
  useOpenIssueFromUrl(allBoardIssues, setSelectedIssue, { showNotFound: true, projectId })

  const { focusedIssueId } = useBoardKeyboardNav({
    flatBoardIssues,
    onOpenIssue: setSelectedIssue,
    isDetailOpen: !!selectedIssue,
  })

  // PM-78: parse search-input operators (`assignee:me status:open …`).
  // AND-merge into FilterState before passing to filterBoard so the
  // popover-set chips and the typed operators both contribute.
  const currentUserId = useAuthStore((s) => s.user?.id)
  const effective = useMemo(() => {
    if (!hasOperators(filters.search)) return filters
    const parsed = parseSearchQuery(filters.search, {
      currentUserId,
      members: assignedMembers,
      labels: boardLabels,
      modules: boardModules,
      epics: boardEpics.map((e) => ({ id: e.id, title: e.title })),
    })
    return applyParsedSearch(filters, parsed)
  }, [filters, currentUserId, assignedMembers, boardLabels, boardModules, boardEpics])
  const hasFilters = hasActiveFilters(effective)

  const filteredBoard = useMemo(
    () => (hasFilters ? filterBoard(parentOnlyBoard, effective, { childrenMap, projectKey }) : parentOnlyBoard),
    [parentOnlyBoard, hasFilters, effective, childrenMap, projectKey],
  )

  // Use parentOnlyBoard (sub-tasks excluded) so they stop double-rendering
  // as standalone cards in the "No Epic" lane while still appearing nested
  // under their parent Task via childrenMap.
  const filteredBoardForSwimlane = useMemo(() => {
    if (!groupByEpic) return null
    if (!hasFilters) return parentOnlyBoard
    return filterBoard(parentOnlyBoard, effective, { keepEpics: true, childrenMap, projectKey })
  }, [groupByEpic, parentOnlyBoard, hasFilters, effective, childrenMap, projectKey])

  const handleDragEnd = (result: DropResult) => {
    // While a server sort is active the cards aren't in manual order,
    // so reordering would write a meaningless `order` value. The drag
    // handle is already disabled in the column rendering — this is a
    // defence-in-depth no-op.
    if (sortActive) return
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

  const taskish = flatBoardIssues.filter((i) => i.type !== 'EPIC' && i.type !== 'DOMAIN')

  return (
    // `overflow-hidden` here is load-bearing: BoardColumn uses `min-w-max`
    // inside the horizontal-scroll container; without `min-w-0` + clipped
    // outer the AppLayout `<main>`'s `overflow-auto` ends up holding the
    // scrollbar and dragging the whole page (TOC sidebar included) when
    // the user scrolls the board. Both axes need to be clipped here so
    // every nested scroll stays nested.
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page-level header spans the full Board width — TOC sidebar
          slots BELOW it, not beside, so the title + toolbar always
          read as one unit. */}
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
          toggleReviewer={(id) => setFilters({ reviewers: toggleSet(filters.reviewers, id) })}
          toggleCreator={(id) => setFilters({ creators: toggleSet(filters.creators, id) })}
          toggleLabel={(id) => setFilters({ labels: toggleSet(filters.labels, id) })}
          toggleComponent={(id) => setFilters({ components: toggleSet(filters.components, id) })}
          setEpicId={(id) => setFilters({ epicId: id })}
          toggleEpicOwner={(id) => setFilters({ epicOwners: toggleSet(filters.epicOwners, id) })}
          assignedMembers={assignedMembers}
          boardReviewers={boardReviewers}
          boardCreators={boardCreators}
          boardLabels={boardLabels}
          boardComponents={boardComponents}
          boardEpics={boardEpics}
          boardModules={boardModules}
          epicOwners={epicOwners}
          hasFilters={hasFilters}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          groupByEpic={groupByEpic}
          setGroupByEpic={setGroupByEpic}
          showSubtasks={showSubtasks}
          setShowSubtasks={setShowSubtasks}
          onExpandAll={expandAllSwimlanes}
          onCollapseAll={collapseAllSwimlanes}
        />
      </div>

      {sortActive && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          Drag-and-drop is disabled while a sort is applied — Reset the sort to drag cards manually.
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <BoardTocSidebar
          toc={toc}
          boardEpics={boardEpics}
          taskish={taskish}
          childrenMap={childrenMap}
          allIssuesById={allIssuesById}
          onIssueClick={handleTocClick}
          collapsed={!tocOpen}
          onToggleCollapse={toggleTocOpen}
        />
      {/* min-w-0 lets this flex child shrink below its content's
          min-w-max so horizontal scroll stays here, not on `<main>`. */}
      <div className="flex flex-1 min-h-0 min-w-0 flex-col p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : groupByEpic ? (
          <div className="h-full overflow-auto">
            <SwimlaneBoardView
              board={filteredBoardForSwimlane || {}}
              projectKey={projectKey}
              projectId={projectId}
              onIssueClick={setSelectedIssue}
              onEpicClick={setSelectedIssue}
              onReorder={(issueId, status, order) => reorder.mutate({ issueId, status, order })}
              onSwimlaneReorder={(epicId, status, order) => reorder.mutate({ issueId: epicId, status, order })}
              onEpicChange={(issueId, newParentId) => updateIssue.mutate({ issueId, data: { parentId: newParentId } })}
              onAssigneeChange={(issueId, assigneeId) => updateIssue.mutate({ issueId, data: { assigneeId } })}
              onAddClick={(status, parentId) => setCreateModal({ status, parentId })}
              childrenMap={childrenMap}
              expandedIssues={expandedIssues}
              onToggleExpand={toggleExpand}
              onChildClick={openChild}
              onChildStatusToggle={toggleChildStatus}
              epicOwnersFilter={filters.epicOwners}
              domainFilter={filters.domainId}
              epics={boardEpics}
              members={assignedMembers}
              collapsedEpics={collapsedEpics}
              onCollapseToggle={toggleCollapse}
              epicAncestorMap={epicAncestorMap}
              allIssuesById={allIssuesById}
            />
          </div>
        ) : (
          // Drag-scroll cursor removed: card surface is the dnd drag-handle
          // so a mouse drag picks up the card, not the board. Use trackpad
          // swipe or the scrollbar to pan horizontally. See PM-43 for a
          // follow-up to add a dedicated drag-handle column.
          <div ref={dragScrollRef} className="h-full overflow-x-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex h-full min-w-max gap-4">
                {BOARD_COLUMN_ORDER.map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    issues={filteredBoard?.[status] || []}
                    projectKey={projectKey}
                    projectId={projectId}
                    onIssueClick={setSelectedIssue}
                    onAddClick={(status, parentId) => setCreateModal({ status, parentId })}
                    childrenMap={childrenMap}
                    expandedIssues={expandedIssues}
                    onToggleExpand={toggleExpand}
                    onChildClick={openChild}
                    onChildStatusToggle={toggleChildStatus}
                    focusedIssueId={focusedIssueId}
                    epics={boardEpics}
                    onEpicChange={(issueId, newParentId) => updateIssue.mutate({ issueId, data: { parentId: newParentId } })}
                    members={assignedMembers}
                    onAssigneeChange={(issueId, assigneeId) => updateIssue.mutate({ issueId, data: { assigneeId } })}
                  />
                ))}
              </div>
            </DragDropContext>
          </div>
        )}
      </div>
      </div>

      {createModal && (
        <CreateIssueModal
          projectId={projectId}
          defaultStatus={createModal.status}
          defaultParentId={createModal.parentId ?? undefined}
          onClose={() => setCreateModal(null)}
        />
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
