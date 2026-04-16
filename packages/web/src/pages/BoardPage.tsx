import { useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { Rows3 } from 'lucide-react'
import { issueApi, type Issue } from '@/api/issues'
import { projectApi } from '@/api/projects'
import type { ChildIssue } from '@/components/board/types'
import BoardColumn from '@/components/board/BoardColumn'
import SwimlaneBoardView from '@/components/board/SwimlaneBoardView'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import IssueDetailPanel from '@/components/issue/IssueDetailPanel'
import { AssigneeAvatars, LabelChips, ComponentChips, EpicChips, FilterDivider, ClearFiltersButton, SearchInput, DropdownFilters, toggleSet } from '@/components/filter/FilterBar'
import { useOpenIssueFromUrl } from '@/hooks/useOpenIssueFromUrl'
import { STATUSES, calculateDropOrder } from '@/lib/constants'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { cn } from '@/lib/utils'

// Shared filter predicate for both flat and swimlane modes
function matchesFilters(
  issue: Issue,
  filters: {
    assignees: Set<string>; labels: Set<string>; components: Set<string>
    epicId: string | null; search: string; status: Set<string>; priority: Set<string>; type: Set<string>
  },
  options?: { keepEpics?: boolean; childrenMap?: Map<string, ChildIssue[]> },
): boolean {
  if (options?.keepEpics && issue.type === 'EPIC') return true
  const { assignees, labels, components, epicId, search, status, priority, type } = filters
  const searchLower = search.toLowerCase()

  // Assignee check: also match if any sub-task is assigned to a selected assignee
  let assigneeMatch = assignees.size === 0 || (!!issue.assigneeId && assignees.has(issue.assigneeId))
  if (!assigneeMatch && assignees.size > 0 && options?.childrenMap) {
    const children = options.childrenMap.get(issue.id)
    if (children) {
      assigneeMatch = children.some((c) => c.assignee && assignees.has(c.assignee.id))
    }
  }

  return (
    assigneeMatch &&
    (labels.size === 0 || issue.labels.some((il) => labels.has(il.label.id))) &&
    (components.size === 0 || issue.components?.some((ic) => components.has(ic.component.id))) &&
    (!epicId || issue.id === epicId || issue.parentId === epicId) &&
    (!search || issue.title.toLowerCase().includes(searchLower) || String(issue.number).includes(search)) &&
    (status.size === 0 || status.has(issue.status)) &&
    (priority.size === 0 || priority.has(issue.priority)) &&
    (type.size === 0 || type.has(issue.type))
  )
}

function filterBoard(
  source: Record<string, Issue[]> | undefined,
  filters: Parameters<typeof matchesFilters>[1],
  options?: { keepEpics?: boolean; childrenMap?: Map<string, ChildIssue[]> },
): Record<string, Issue[]> {
  if (!source) return {}
  const filtered: Record<string, Issue[]> = {}
  for (const [status, issues] of Object.entries(source)) {
    const matching = issues.filter((issue) => matchesFilters(issue, filters, options))
    if (matching.length > 0) filtered[status] = matching
  }
  return filtered
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [createModal, setCreateModal] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set())
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set())
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set())
  const [filterPriority, setFilterPriority] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<Set<string>>(new Set())
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())
  const [groupByEpic, setGroupByEpic] = useState(false)
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['board', projectId],
    queryFn: () => issueApi.board(projectId!),
    enabled: !!projectId,
  })

  const reorderMutation = useMutation({
    mutationFn: (args: { issueId: string; status: string; order: number }) =>
      issueApi.reorder(projectId!, args.issueId, { status: args.status, order: args.order }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reorder issue'))
    },
  })

  const updateIssueMutation = useMutation({
    mutationFn: (args: { issueId: string; data: { status?: string; parentId?: string | null } }) =>
      issueApi.update(projectId!, args.issueId, args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    },
  })

  // Build id->Issue map for O(1) lookups
  const allIssuesById = useMemo(() => {
    const map = new Map<string, Issue>()
    if (!board) return map
    for (const issues of Object.values(board)) {
      for (const issue of issues) map.set(issue.id, issue)
    }
    return map
  }, [board])

  // Build children map: parentId -> SUB_TASK children only (shown inline on parent cards)
  const childrenMap = useMemo(() => {
    const map = new Map<string, ChildIssue[]>()
    if (!board) return map
    for (const issues of Object.values(board)) {
      for (const issue of issues) {
        if (issue.parentId && issue.type === 'SUB_TASK') {
          const existing = map.get(issue.parentId) || []
          existing.push({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            status: issue.status,
            priority: issue.priority,
            assignee: issue.assignee ? { id: issue.assignee.id, name: issue.assignee.name, avatar: issue.assignee.avatar } : null,
          })
          map.set(issue.parentId, existing)
        }
      }
    }
    return map
  }, [board])

  // Filter board: hide SUB_TASKs (shown inline on parent cards), keep TASK/BUG even if under an epic
  const parentOnlyBoard = useMemo(() => {
    if (!board) return board
    const filtered: Record<string, Issue[]> = {}
    for (const [status, issues] of Object.entries(board)) {
      filtered[status] = issues.filter((issue) => issue.type !== 'SUB_TASK')
    }
    return filtered
  }, [board])

  // Open issue detail from share link (?open= query param)
  const allBoardIssues = useMemo(() => board ? Object.values(board).flat() : undefined, [board])
  useOpenIssueFromUrl(allBoardIssues, setSelectedIssue, { showNotFound: true })

  const handleAddClick = useCallback((status: string) => {
    setCreateModal(status)
  }, [])

  // Shared filter config
  const filters = useMemo(() => ({
    assignees: selectedAssignees, labels: selectedLabels, components: selectedComponents,
    epicId: selectedEpicId, search, status: filterStatus, priority: filterPriority, type: filterType,
  }), [selectedAssignees, selectedLabels, selectedComponents, selectedEpicId, search, filterStatus, filterPriority, filterType])

  const hasFilters = selectedAssignees.size > 0 || selectedLabels.size > 0 || selectedComponents.size > 0 || !!selectedEpicId || !!search || filterStatus.size > 0 || filterPriority.size > 0 || filterType.size > 0

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const destStatus = destination.droppableId
    const rawIssues = (parentOnlyBoard?.[destStatus] || [])

    const destIssues = destination.droppableId === source.droppableId
      ? rawIssues.filter(issue => issue.id !== draggableId)
      : rawIssues

    const newOrder = calculateDropOrder(destIssues, destination.index)
    reorderMutation.mutate({ issueId: draggableId, status: destStatus, order: newOrder })
  }

  const handleToggleExpand = useCallback((issueId: string) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev)
      if (next.has(issueId)) next.delete(issueId)
      else next.add(issueId)
      return next
    })
  }, [])

  const handleChildClick = useCallback((child: ChildIssue) => {
    const found = allIssuesById.get(child.id)
    if (found) setSelectedIssue(found)
  }, [allIssuesById])

  const handleChildStatusToggle = useCallback((child: ChildIssue) => {
    const newStatus = child.status === 'DONE' ? 'TODO' : 'DONE'
    updateIssueMutation.mutate({ issueId: child.id, data: { status: newStatus } })
  }, [updateIssueMutation.mutate])

  const assignedMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    Object.values(board || {}).flat().forEach((issue) => {
      if (issue.assignee) memberMap.set(issue.assignee.id, issue.assignee)
    })
    return [...memberMap.values()]
  }, [board])

  const boardLabels = useMemo(() => {
    const labelMap = new Map<string, { id: string; name: string; color: string }>()
    Object.values(board || {}).flat().forEach((issue) => {
      issue.labels.forEach((il) => labelMap.set(il.label.id, il.label))
    })
    return [...labelMap.values()]
  }, [board])

  const boardComponents = useMemo(() => {
    const compMap = new Map<string, { id: string; name: string }>()
    Object.values(board || {}).flat().forEach((issue) => {
      issue.components?.forEach((ic) => compMap.set(ic.component.id, ic.component))
    })
    return [...compMap.values()]
  }, [board])

  const boardEpics = useMemo(() => {
    const epics: Issue[] = []
    Object.values(board || {}).flat().forEach((issue) => {
      if (issue.type === 'EPIC') epics.push(issue)
    })
    return epics
  }, [board])

  const filteredBoard = useMemo(() => {
    if (!hasFilters) return parentOnlyBoard
    return filterBoard(parentOnlyBoard, filters, { childrenMap })
  }, [parentOnlyBoard, hasFilters, filters, childrenMap])

  const filteredBoardForSwimlane = useMemo(() => {
    if (!groupByEpic) return null
    if (!hasFilters) return board
    return filterBoard(board, filters, { keepEpics: true, childrenMap })
  }, [groupByEpic, board, hasFilters, filters, childrenMap])

  const handleSwimlaneReorder = useCallback((issueId: string, status: string, order: number) => {
    reorderMutation.mutate({ issueId, status, order })
  }, [reorderMutation.mutate])

  const handleSwimlaneEpicChange = useCallback((issueId: string, newParentId: string | null) => {
    updateIssueMutation.mutate({ issueId, data: { parentId: newParentId } })
  }, [updateIssueMutation.mutate])

  const toggleAssignee = useCallback((id: string) => {
    setSelectedAssignees((prev) => toggleSet(prev, id))
  }, [])

  const toggleLabel = useCallback((id: string) => {
    setSelectedLabels((prev) => toggleSet(prev, id))
  }, [])

  const toggleComponent = useCallback((id: string) => {
    setSelectedComponents((prev) => toggleSet(prev, id))
  }, [])

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {project?.key} Board
          </h1>
          <p className="text-sm text-gray-500">{project?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <DropdownFilters
            status={filterStatus} priority={filterPriority} type={filterType}
            onStatusChange={setFilterStatus} onPriorityChange={setFilterPriority} onTypeChange={setFilterType}
          />
          <FilterDivider />
          <AssigneeAvatars members={assignedMembers} selected={selectedAssignees} onToggle={toggleAssignee} />
          <LabelChips labels={boardLabels} selected={selectedLabels} onToggle={toggleLabel} />
          <ComponentChips components={boardComponents} selected={selectedComponents} onToggle={toggleComponent} />
          <EpicChips epics={boardEpics} selectedId={selectedEpicId} onSelect={setSelectedEpicId} />
          {hasFilters && (
            <ClearFiltersButton onClick={() => { setSelectedAssignees(new Set()); setSelectedLabels(new Set()); setSelectedComponents(new Set()); setSelectedEpicId(null); setSearch(''); setFilterStatus(new Set()); setFilterPriority(new Set()); setFilterType(new Set()) }} />
          )}
          <FilterDivider />
          <button
            type="button"
            onClick={() => setGroupByEpic(!groupByEpic)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
              groupByEpic
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50',
            )}
          >
            <Rows3 className="h-3.5 w-3.5" />
            Group: Epic
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isBoardLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : groupByEpic ? (
          <SwimlaneBoardView
            board={filteredBoardForSwimlane || {}}
            projectKey={project?.key || ''}
            onIssueClick={setSelectedIssue}
            onReorder={handleSwimlaneReorder}
            onEpicChange={handleSwimlaneEpicChange}
            childrenMap={childrenMap}
            expandedIssues={expandedIssues}
            onToggleExpand={handleToggleExpand}
            onChildClick={handleChildClick}
            onChildStatusToggle={handleChildStatusToggle}
          />
        ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                issues={filteredBoard?.[status] || []}
                projectKey={project?.key || ''}
                onIssueClick={setSelectedIssue}
                onAddClick={handleAddClick}
                childrenMap={childrenMap}
                expandedIssues={expandedIssues}
                onToggleExpand={handleToggleExpand}
                onChildClick={handleChildClick}
                onChildStatusToggle={handleChildStatusToggle}
              />
            ))}
          </div>
        </DragDropContext>
        )}
      </div>

      {createModal && (
        <CreateIssueModal
          projectId={projectId}
          defaultStatus={createModal}
          onClose={() => setCreateModal(null)}
        />
      )}

      {selectedIssue && (
        <IssueDetailPanel
          projectId={projectId}
          projectKey={project?.key || ''}
          issue={selectedIssue}
          context="board"
          onClose={() => setSelectedIssue(null)}
          onNavigate={setSelectedIssue}
        />
      )}
    </div>
  )
}
