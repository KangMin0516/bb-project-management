import { useState, useCallback, useDeferredValue, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, type Issue } from '@/api/issues'
import { projectApi } from '@/api/projects'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge, isIssueOverdue } from '@/lib/time'
import {
  AssigneeAvatars, LabelChips, FilterDivider, ClearFiltersButton,
  DropdownFilters, SearchInput, hasActiveFilters, toggleSet,
  type FilterState, INITIAL_FILTER,
} from '@/components/filter/FilterBar'
import ViewToggle, { type ViewOption } from '@/components/view/ViewToggle'
import IssueTreeView from '@/components/issue/IssueTreeView'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import { Plus, ChevronUp, ChevronDown, List, GitBranch } from 'lucide-react'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'

type SortField = 'number' | 'status' | 'priority' | 'createdAt' | 'dueDate'
type ViewMode = 'list' | 'grouped'

const VIEW_OPTIONS: ViewOption<ViewMode>[] = [
  { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> },
  { value: 'grouped', label: 'Grouped', icon: <GitBranch className="h-3.5 w-3.5" /> },
]

export default function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER)
  const deferredSearch = useDeferredValue(filters.search)
  const [sortBy, setSortBy] = useState<SortField | ''>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('issues-view-mode') as ViewMode) || 'list'
  )
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
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

  const { data, isLoading } = useQuery({
    queryKey: ['issues', projectId, params],
    queryFn: () => issueApi.list(projectId!, params),
    enabled: !!projectId,
  })

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

  // Client-side label filter (server doesn't support label filtering)
  const displayItems = useMemo(() => {
    if (!data?.items) return []
    if (filters.labels.size === 0) return data.items
    return data.items.filter((issue) =>
      issue.labels.some((il) => filters.labels.has(il.label.id))
    )
  }, [data?.items, filters.labels])

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

      {/* Filters */}
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
        {hasActiveFilters(filters) && (
          <ClearFiltersButton onClick={() => setFilters(INITIAL_FILTER)} />
        )}
      </div>

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
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
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
                    className={cn('cursor-pointer hover:bg-gray-50', overdue && 'bg-red-50/50')}
                  >
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
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this issue?')) deleteMutation.mutate(issue.id)
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-400">
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

      {/* Issue Detail Slide-over */}
      {selectedIssue && (
        <IssueSlideOver
          projectId={projectId}
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  )
}

// Lightweight detail slide-over for the issues table
function IssueSlideOver({
  projectId,
  issue,
  onClose,
}: {
  projectId: string
  issue: Issue
  onClose: () => void
}) {
  const { data: detail } = useQuery({
    queryKey: ['issue', projectId, issue.id],
    queryFn: () => issueApi.get(projectId, issue.id),
  })

  const d = detail || issue
  const badge = getDueBadge(d.dueDate)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-gray-400">#{d.number}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <h2 className="mt-1 text-lg font-bold text-gray-900">{d.title}</h2>
        </div>
        <div className="space-y-3 p-6 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-medium text-gray-500">Status</span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[d.status])} />
                <span>{d.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500">Priority</span>
              <span className={cn('mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium', PRIORITY_COLORS[d.priority])}>
                {d.priority}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500">Type</span>
              <span className="mt-0.5">{TYPE_ICONS[d.type] || '📋'} {d.type.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500">Assignee</span>
              <span className="mt-0.5">{d.assignee?.name || 'Unassigned'}</span>
            </div>
            {d.dueDate && (
              <div>
                <span className="block text-xs font-medium text-gray-500">Due Date</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span>{new Date(d.dueDate).toLocaleDateString()}</span>
                  {badge && (
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
                      {badge.text}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div>
              <span className="block text-xs font-medium text-gray-500">Creator</span>
              <span className="mt-0.5">{d.creator?.name}</span>
            </div>
          </div>
          {d.description && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Description</span>
              <p className="whitespace-pre-wrap text-gray-700">{d.description}</p>
            </div>
          )}
          {d.labels.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Labels</span>
              <div className="flex flex-wrap gap-1">
                {d.labels.map((l) => (
                  <span
                    key={l.label.id}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: l.label.color + '20', color: l.label.color }}
                  >
                    {l.label.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
