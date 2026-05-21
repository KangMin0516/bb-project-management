import { useState, useDeferredValue, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Plus, List, GitBranch } from 'lucide-react'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { useIssueListData } from '@/features/issue/hooks/useIssueListData'
import { useIssueListSelection } from '@/features/issue/hooks/useIssueListSelection'
import { useIssueListUrlState, type ViewMode } from '@/features/issue/hooks/useIssueListUrlState'
import { useOpenIssueFromUrl } from '@/features/issue/hooks/useOpenIssueFromUrl'
import { applyClientFilters, buildListParams } from '@/features/issue/lib/issueClientFilter'
import IssuesTable from '@/features/issue/components/list/IssuesTable'
import IssuesToolbar from '@/features/issue/components/list/IssuesToolbar'
import IssueTreeView from '@/features/issue/components/IssueTreeView'
import CreateIssueModal from '@/features/issue/components/CreateIssueModal'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import BulkActionBar from '@/features/issue/components/BulkActionBar'
import type { ViewOption } from '@/shared/ui/ViewToggle'
import type { Issue } from '@/features/issue/api'

const VIEW_OPTIONS: ViewOption<ViewMode>[] = [
  { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> },
  { value: 'grouped', label: 'Lists', icon: <GitBranch className="h-3.5 w-3.5" /> },
]

/**
 * Composition root for the project issues list / grouped tree view.
 * URL state + selection + keyboard nav are encapsulated in dedicated
 * hooks; only the layout + modals remain inline.
 */
export default function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const { filters, setFilters, resetFilters } = useFilterSearchParams()
  const deferredSearch = useDeferredValue(filters.search)

  const url = useIssueListUrlState()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  const listParams = useMemo(
    () => buildListParams({
      search: deferredSearch,
      filters,
      showArchived: url.showArchived,
      sortBy: url.sortBy || '',
      sortOrder: url.sortOrder,
      viewMode: url.viewMode,
    }),
    [deferredSearch, filters, url.showArchived, url.sortBy, url.sortOrder, url.viewMode],
  )

  const { project, members, projectLabels, projectComponents, list, isLoading, epicChange, remove } =
    useIssueListData({ projectId: projectId ?? '', listParams })

  const displayItems = useMemo(
    () => applyClientFilters(list?.items, filters, { showArchived: url.showArchived }),
    [list?.items, filters, url.showArchived],
  )

  const selection = useIssueListSelection({
    items: displayItems,
    onOpen: setSelectedIssue,
    isDetailOpen: !!selectedIssue,
  })

  // Open from <Link state={{selectedIssueId}}> hand-off (search / notifications).
  useEffect(() => {
    if (!list?.items) return
    const state = location.state as { selectedIssueId?: string } | null
    if (state?.selectedIssueId) {
      const issue = list.items.find((i) => i.id === state.selectedIssueId)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (issue) setSelectedIssue(issue)
      window.history.replaceState({}, '')
    }
  }, [location.state, list?.items])

  // Open from ?open= deep-link.
  useOpenIssueFromUrl(list?.items, setSelectedIssue)

  if (!projectId) return null

  const memberList = members?.map((m) => m.user) ?? []
  const projectKey = project?.key ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{projectKey} Lists</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          New Issue
        </button>
      </div>

      {selection.selectedIds.size > 0 ? (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2">
          <BulkActionBar
            projectId={projectId}
            selectedIds={selection.selectedIds}
            selectedTypes={displayItems
              .filter((i) => selection.selectedIds.has(i.id))
              .map((i) => i.type)}
            members={memberList.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar }))}
            onClear={selection.clear}
          />
        </div>
      ) : (
        <IssuesToolbar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          members={memberList}
          projectLabels={projectLabels ?? []}
          projectComponents={projectComponents ?? []}
          viewMode={url.viewMode}
          setViewMode={url.setViewMode}
          showArchived={url.showArchived}
          setShowArchived={url.setShowArchived}
          viewOptions={VIEW_OPTIONS}
        />
      )}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : url.viewMode === 'grouped' ? (
          <IssueTreeView
            issues={displayItems}
            projectKey={projectKey}
            onIssueClick={setSelectedIssue}
            onEpicChange={(issueId, parentId) => epicChange.mutate({ issueId, parentId })}
          />
        ) : (
          <IssuesTable
            items={displayItems}
            projectKey={projectKey}
            selectedIds={selection.selectedIds}
            focusedRowIndex={selection.focusedRowIndex}
            tableRef={selection.tableRef}
            sortBy={url.sortBy || ''}
            sortOrder={url.sortOrder}
            onToggleSort={url.toggleSort}
            onToggleSelectAll={selection.toggleAll}
            onToggleSelect={selection.toggleOne}
            onOpen={setSelectedIssue}
            onDelete={(id) => remove.mutate(id)}
          />
        )}
      </div>

      {list && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{displayItems.length} issues</span>
        </div>
      )}

      {showCreate && <CreateIssueModal projectId={projectId} onClose={() => setShowCreate(false)} />}

      {selectedIssue && (
        <IssueDetailPanel
          projectId={projectId}
          projectKey={projectKey}
          issue={selectedIssue}
          context="issues"
          onClose={() => setSelectedIssue(null)}
          onNavigate={setSelectedIssue}
        />
      )}
    </div>
  )
}
