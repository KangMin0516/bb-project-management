import { useState, useCallback, useDeferredValue, useMemo, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, type Issue } from '@/api/issues'
import { projectApi } from '@/api/projects'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge, isIssueOverdue } from '@/lib/time'
import {
  AssigneeAvatars, LabelChips, ComponentChips, FilterDivider, ClearFiltersButton,
  DropdownFilters, SearchInput, hasActiveFilters, toggleSet,
  type FilterState, INITIAL_FILTER,
} from '@/components/filter/FilterBar'
import { componentApi } from '@/api/components'
import ViewToggle, { type ViewOption } from '@/components/view/ViewToggle'
import IssueTreeView from '@/components/issue/IssueTreeView'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import IssueDetailPanel from '@/components/issue/IssueDetailPanel'
import BulkActionBar from '@/components/issue/BulkActionBar'
import IssueActionMenu from '@/components/issue/IssueActionMenu'
import { useOpenIssueFromUrl } from '@/hooks/useOpenIssueFromUrl'
import { Plus, ChevronUp, ChevronDown, List, GitBranch } from 'lucide-react'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'

type SortField = 'number' | 'status' | 'priority' | 'createdAt' | 'dueDate'
type ViewMode = 'list' | 'grouped'

const VIEW_OPTIONS: ViewOption<ViewMode>[] = [
  { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> },
  { value: 'grouped', label: 'Lists', icon: <GitBranch className="h-3.5 w-3.5" /> },
]

export default function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER)
  const deferredSearch = useDeferredValue(filters.search)
  const [sortBy, setSortBy] = useState<SortField | ''>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('issues-view-mode') as ViewMode) || 'list'
  )
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('issues-view-mode', mode)
  }, [])

  const updateFilter = useCallback((patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const toggleAssignee = useCallback((id: string) => {
    setFilters((prev) => ({ ...prev, assignees: toggleSet(prev.assignees, id) }))
  }, [])

  const toggleLabel = useCallback((id: string) => {
    setFilters((prev) => ({ ...prev, labels: toggleSet(prev.labels, id) }))
  }, [])

  const toggleComponent = useCallback((id: string) => {
    setFilters((prev) => ({ ...prev, components: toggleSet(prev.components, id) }))
  }, [])

  // Build query params — bulk load all issues (no pagination)
  const params: Record<string, string> = { limit: '200' }
  if (deferredSearch) params.search = deferredSearch
  if (filters.status) params.status = filters.status
  if (filters.priority) params.priority = filters.priority
  if (filters.type) params.type = filters.type
  // Server only supports single assigneeId — send first selected
  const firstAssignee = [...filters.assignees][0]
  if (firstAssignee) params.assigneeId = firstAssignee
  if (viewMode === 'list' && sortBy) { params.sortBy = sortBy; params.sortOrder = sortOrder }

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: members } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectApi.listMembers(projectId!),
    enabled: !!projectId,
  })

  const { data: projectLabels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectApi.listLabels(projectId!),
    enabled: !!projectId,
  })

  const { data: projectComponents } = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId!),
    enabled: !!projectId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['issues', projectId, params],
    queryFn: () => issueApi.list(projectId!, params),
    enabled: !!projectId,
  })

  // Open issue detail from location state (search/notification)
  useEffect(() => {
    if (!data?.items) return
    const state = location.state as { selectedIssueId?: string } | null
    if (state?.selectedIssueId) {
      const issue = data.items.find((i) => i.id === state.selectedIssueId)
      if (issue) setSelectedIssue(issue)
      window.history.replaceState({}, '')
    }
  }, [location.state, data?.items])

  // Open issue detail from share link (?open= query param)
  useOpenIssueFromUrl(data?.items, setSelectedIssue)

  const epicChangeMutation = useMutation({
    mutationFn: ({ issueId, parentId }: { issueId: string; parentId: string | null }) =>
      issueApi.update(projectId!, issueId, { parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to change epic'))
    },
  })

  const handleEpicChange = useCallback((issueId: string, newParentId: string | null) => {
    epicChangeMutation.mutate({ issueId, parentId: newParentId })
  }, [epicChangeMutation])

  const deleteMutation = useMutation({
    mutationFn: (issueId: string) => issueApi.delete(projectId!, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete issue'))
    },
  })

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronDown className="ml-0.5 inline h-3 w-3 opacity-0 group-hover:opacity-40" />
    return sortOrder === 'asc'
      ? <ChevronUp className="ml-0.5 inline h-3 w-3 text-primary-600" />
      : <ChevronDown className="ml-0.5 inline h-3 w-3 text-primary-600" />
  }

  const memberList = members?.map((m) => m.user) || []

  // Client-side label & component filter (server doesn't support these)
  const displayItems = useMemo(() => {
    if (!data?.items) return []
    let items = data.items
    if (filters.labels.size > 0) {
      items = items.filter((issue) =>
        issue.labels.some((il) => filters.labels.has(il.label.id))
      )
    }
    if (filters.components.size > 0) {
      items = items.filter((issue) =>
        issue.components?.some((ic) => filters.components.has(ic.component.id))
      )
    }
    return items
  }, [data?.items, filters.labels, filters.components])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === displayItems.length && displayItems.length > 0) return new Set()
      return new Set(displayItems.map((i) => i.id))
    })
  }, [displayItems])

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-gray-900">{project?.key} Issues</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          New Issue
        </button>
      </div>

      {/* Bulk Action Bar / Filters */}
      {selectedIds.size > 0 ? (
        <div className="border-b border-gray-200 bg-white px-6 py-2">
          <BulkActionBar
            projectId={projectId}
            selectedIds={selectedIds}
            members={memberList.map((m) => ({ id: m.id, name: m.name }))}
            onClear={() => setSelectedIds(new Set())}
          />
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-6 py-2">
        <ViewToggle options={VIEW_OPTIONS} value={viewMode} onChange={handleViewChange} />
        <FilterDivider />
        <SearchInput value={filters.search} onChange={(v) => updateFilter({ search: v })} />
        <DropdownFilters
          status={filters.status}
          priority={filters.priority}
          type={filters.type}
          onStatusChange={(v) => updateFilter({ status: v })}
          onPriorityChange={(v) => updateFilter({ priority: v })}
          onTypeChange={(v) => updateFilter({ type: v })}
        />
        {memberList.length > 0 && <FilterDivider />}
        <AssigneeAvatars members={memberList} selected={filters.assignees} onToggle={toggleAssignee} />
        {(projectLabels?.length ?? 0) > 0 && <FilterDivider />}
        <LabelChips labels={projectLabels || []} selected={filters.labels} onToggle={toggleLabel} />
        {(projectComponents?.length ?? 0) > 0 && <FilterDivider />}
        <ComponentChips components={projectComponents || []} selected={filters.components} onToggle={toggleComponent} />
        {hasActiveFilters(filters) && (
          <ClearFiltersButton onClick={() => setFilters(INITIAL_FILTER)} />
        )}
      </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : viewMode === 'grouped' ? (
          <IssueTreeView
            issues={displayItems}
            projectKey={project?.key || ''}
            onIssueClick={setSelectedIssue}
            onEpicChange={handleEpicChange}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={displayItems.length > 0 && selectedIds.size === displayItems.length}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="group cursor-pointer px-6 py-2" onClick={() => toggleSort('number')}>
                  ID <SortIcon field="number" />
                </th>
                <th className="px-3 py-2">Title</th>
                <th className="group cursor-pointer px-3 py-2" onClick={() => toggleSort('status')}>
                  Status <SortIcon field="status" />
                </th>
                <th className="group cursor-pointer px-3 py-2" onClick={() => toggleSort('priority')}>
                  Priority <SortIcon field="priority" />
                </th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="group cursor-pointer px-3 py-2" onClick={() => toggleSort('dueDate')}>
                  Due <SortIcon field="dueDate" />
                </th>
                <th className="group cursor-pointer px-3 py-2" onClick={() => toggleSort('createdAt')}>
                  Created <SortIcon field="createdAt" />
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayItems.map((issue) => {
                const badge = getDueBadge(issue.dueDate)
                const overdue = isIssueOverdue(issue)
                return (
                  <tr
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className={cn(
                      'cursor-pointer hover:bg-gray-50',
                      overdue && 'bg-red-50/50',
                      selectedIds.has(issue.id) && 'bg-primary-50',
                    )}
                  >
                    <td className="w-8 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(issue.id)}
                        onChange={() => toggleSelectOne(issue.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-2 font-mono text-xs text-gray-400">
                      {project?.key}-{issue.number}
                    </td>
                    <td className={cn('max-w-xs truncate px-3 py-2 font-medium', overdue ? 'text-red-700' : 'text-gray-900')}>
                      <span className="mr-1 text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
                      {issue.title}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
                        <span className="text-xs text-gray-600">{issue.status.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{issue.type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {issue.assignee?.name || '-'}
                    </td>
                    <td className="px-3 py-2">
                      {badge && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
                          {badge.text}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-400">
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <IssueActionMenu
                        projectKey={project?.key || ''}
                        issueNumber={issue.number}
                        context="issues"
                        onDelete={() => {
                          if (confirm('Delete this issue?')) deleteMutation.mutate(issue.id)
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-400">
                    No issues found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Issue count */}
      {data && (
        <div className="border-t border-gray-200 bg-white px-6 py-2">
          <span className="text-xs text-gray-500">{displayItems.length} issues</span>
        </div>
      )}

      {showCreate && (
        <CreateIssueModal projectId={projectId} onClose={() => setShowCreate(false)} />
      )}

      {/* Issue Detail Panel */}
      {selectedIssue && (
        <IssueDetailPanel
          projectId={projectId}
          projectKey={project?.key || ''}
          issue={selectedIssue}
          context="issues"
          onClose={() => setSelectedIssue(null)}
          onNavigate={setSelectedIssue}
        />
      )}
    </div>
  )
}
