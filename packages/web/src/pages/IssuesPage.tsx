import { useState, useDeferredValue, useEffect, useMemo, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, List, GitBranch } from 'lucide-react'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { useAuthStore } from '@/features/auth/store'
import {
  applyParsedSearch,
  hasOperators,
  parseSearchQuery,
} from '@/shared/lib/search-query'
import { useIssueListData } from '@/features/issue/hooks/useIssueListData'
import { issueRepository } from '@/features/issue/repository'
import { useIssueListSelection } from '@/features/issue/hooks/useIssueListSelection'
import { useIssueListUrlState, type ViewMode } from '@/features/issue/hooks/useIssueListUrlState'
import { useOpenIssueFromUrl } from '@/features/issue/hooks/useOpenIssueFromUrl'
import { applyClientFilters, buildListParams } from '@/features/issue/lib/issueClientFilter'
import IssuesTable from '@/features/issue/components/list/IssuesTable'
import IssuesToolbar from '@/features/issue/components/list/IssuesToolbar'
import IssueTreeView from '@/features/issue/components/IssueTreeView'
import CreateIssueModal from '@/features/issue/components/CreateIssueModal'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import type { IssueDetailTab } from '@/features/issue/components/detail/IssueDetailTabs'
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
  const currentUserId = useAuthStore((s) => s.user?.id)

  // PM-78: parse operators out of the search input. First pass uses
  // user-only context so it's available before useIssueListData fetches
  // members/labels — drives BE params + initial display. A second pass
  // (with full ctx) runs after fetching so `label:bug` / `module:X`
  // resolve to ids client-side.
  const beEffective = useMemo(() => {
    if (!hasOperators(filters.search)) return filters
    const parsed = parseSearchQuery(filters.search, { currentUserId })
    return applyParsedSearch(filters, parsed)
  }, [filters, currentUserId])

  const url = useIssueListUrlState()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  // Tab the detail panel opens on — set by notification hand-off, reset on
  // any manual open.
  const [initialTab, setInitialTab] = useState<IssueDetailTab | undefined>(undefined)
  // Issue id requested via notification/search hand-off but not yet resolved
  // to a panel — it may be archived / filtered out / on another page.
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null)

  // Manual opens (row click, keyboard, sub-task nav) always land on details.
  const openIssue = useCallback((issue: Issue) => {
    setInitialTab(undefined)
    setSelectedIssue(issue)
  }, [])

  const listParams = useMemo(
    () => buildListParams({
      // When operators are present, beEffective.search is the parsed
      // residual (possibly empty) and must NOT fall back to the raw
      // input — that would re-leak the operator string as a title-match.
      // Otherwise use deferredSearch so plain-text typing stays debounced.
      search: hasOperators(filters.search) ? beEffective.search : deferredSearch,
      filters: beEffective,
      showArchived: url.showArchived,
      sortBy: url.sortBy || '',
      sortOrder: url.sortOrder,
      viewMode: url.viewMode,
    }),
    [filters.search, deferredSearch, beEffective, url.showArchived, url.sortBy, url.sortOrder, url.viewMode],
  )

  const { project, members, projectLabels, projectComponents, list, isLoading, epicChange, remove } =
    useIssueListData({
      projectId: projectId ?? '',
      listParams,
      // The grouped tree needs the whole hierarchy — page through all
      // results so deeper statuses aren't dropped at the 200-row cap.
      fetchAll: url.viewMode === 'grouped',
    })

  // TOC drives the Module + Epic sections of the FiltersPopover. The query
  // is already cached by other pages (BoardPage / TableOfContentPage), so
  // this is effectively free on warm navigation.
  const { data: toc } = useQuery({
    queryKey: ['toc', projectId],
    queryFn: () => issueRepository.findTableOfContent(projectId!),
    enabled: !!projectId,
  })
  const projectModules = useMemo(
    () => toc?.domains.map((d) => ({ id: d.id, title: d.title })) ?? [],
    [toc],
  )
  const projectEpics = useMemo(() => {
    const fromDomains = toc?.domains.flatMap((d) =>
      d.epics.map((e) => ({ id: e.id, title: e.title })),
    ) ?? []
    const orphans =
      toc?.orphanEpics.map((e) => ({ id: e.id, title: e.title })) ?? []
    return [...fromDomains, ...orphans]
  }, [toc])

  // PM-78: second pass with full ctx so label/module/epic operators
  // resolve to ids using fetched project metadata.
  const memberList = useMemo(() => members?.map((m) => m.user) ?? [], [members])
  const fullEffective = useMemo(() => {
    if (!hasOperators(filters.search)) return filters
    const parsed = parseSearchQuery(filters.search, {
      currentUserId,
      members: memberList,
      labels: projectLabels ?? [],
      modules: projectModules,
      epics: projectEpics,
    })
    return applyParsedSearch(filters, parsed)
  }, [filters, currentUserId, memberList, projectLabels, projectModules, projectEpics])

  const displayItems = useMemo(
    () => applyClientFilters(list?.items, fullEffective, { showArchived: url.showArchived }),
    [list?.items, fullEffective, url.showArchived],
  )

  const selection = useIssueListSelection({
    items: displayItems,
    onOpen: openIssue,
    isDetailOpen: !!selectedIssue,
  })

  // Open from <Link state> hand-off (search / notifications). Capture the
  // target id + tab here; resolution happens below so an issue that isn't in
  // the current (filtered / archived / paginated) list still opens.
  useEffect(() => {
    const state = location.state as { selectedIssueId?: string; selectedTab?: IssueDetailTab } | null
    if (!state?.selectedIssueId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingOpenId(state.selectedIssueId)
    setInitialTab(state.selectedTab)
    window.history.replaceState({}, '')
  }, [location.state])

  // Fetch the hand-off target by id when it's absent from the loaded list
  // (e.g. a comment notification for an archived / DONE ticket). Shares the
  // ['issue', ...] cache key the detail panel reads, so it's deduped.
  const inLoadedList = !!pendingOpenId && !!list?.items?.some((i) => i.id === pendingOpenId)
  const { data: fetchedOpenIssue } = useQuery({
    queryKey: ['issue', projectId, pendingOpenId],
    queryFn: () => issueRepository.findOne(projectId!, pendingOpenId!),
    enabled: !!projectId && !!pendingOpenId && !inLoadedList,
  })

  // Resolve a pending open: prefer the already-loaded row, else the fetch.
  // Keeps initialTab intact (so comment notifications land on Activity).
  useEffect(() => {
    if (!pendingOpenId) return
    const fromList = list?.items?.find((i) => i.id === pendingOpenId)
    if (fromList) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIssue(fromList)
      setPendingOpenId(null)
    } else if (fetchedOpenIssue && fetchedOpenIssue.id === pendingOpenId) {
      setSelectedIssue(fetchedOpenIssue)
      setPendingOpenId(null)
    }
  }, [pendingOpenId, list?.items, fetchedOpenIssue])

  // Open from ?open= deep-link. projectId enables the fetch-by-id fallback
  // so a link to an archived / filtered-out issue still opens.
  useOpenIssueFromUrl(list?.items, openIssue, { projectId })

  if (!projectId) return null

  const projectKey = project?.key ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{projectKey} Lists</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
        </div>
        {selection.selectedIds.size > 0 ? (
          <BulkActionBar
            projectId={projectId}
            selectedIds={selection.selectedIds}
            selectedTypes={displayItems
              .filter((i) => selection.selectedIds.has(i.id))
              .map((i) => i.type)}
            members={memberList.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar }))}
            onClear={selection.clear}
          />
        ) : (
          <IssuesToolbar
            filters={filters}
            setFilters={setFilters}
            resetFilters={resetFilters}
            members={memberList}
            projectLabels={projectLabels ?? []}
            projectComponents={projectComponents ?? []}
            projectModules={projectModules}
            projectEpics={projectEpics}
            viewMode={url.viewMode}
            setViewMode={url.setViewMode}
            showArchived={url.showArchived}
            setShowArchived={url.setShowArchived}
            viewOptions={VIEW_OPTIONS}
            rightActions={(
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                New Issue
              </button>
            )}
          />
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : url.viewMode === 'grouped' ? (
          <IssueTreeView
            issues={displayItems}
            projectKey={projectKey}
            onIssueClick={openIssue}
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
            onOpen={openIssue}
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
          initialTab={initialTab}
          onClose={() => setSelectedIssue(null)}
          onNavigate={openIssue}
        />
      )}
    </div>
  )
}
