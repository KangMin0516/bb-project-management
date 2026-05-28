import { useCallback, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DragDropContext } from '@hello-pangea/dnd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { projectRepository } from '@/features/project/repository'
import { componentApi } from '@/features/project/component-api'
import { useAuthStore } from '@/features/auth/store'
import { useCalendarData } from '@/features/calendar/hooks/useCalendarData'
import { useUnscheduledIssues } from '@/features/calendar/hooks/useUnscheduledIssues'
import { useCalendarDnd } from '@/features/calendar/hooks/useCalendarDnd'
import { useFilteredIssues } from '@/features/timeline/hooks/useFilteredIssues'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { hasActiveFilters, toggleSet } from '@/shared/ui/filterState'
import { getBool, setBool } from '@/shared/lib/filter-codec'
import CalendarHeader from '@/features/calendar/components/CalendarHeader'
import EmptyMonthBanner from '@/features/calendar/components/EmptyMonthBanner'
import MonthGrid from '@/features/calendar/components/MonthGrid'
import UnscheduledPanel from '@/features/calendar/components/UnscheduledPanel'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import type { Issue } from '@/features/issue/api'

const UNSCHEDULED_PARAM = 'unscheduled'
const ARCHIVED_PARAM = 'archived'

/**
 * Composition root for the project calendar. Month grid of dueDate-pinned
 * issues. Reuses the Timeline page's `useFilteredIssues` (project-agnostic,
 * filter-state-shaped) and the Board's shared FilterBar primitives so all
 * three views feel identical to the user.
 *
 * PM-58: the right-rail `UnscheduledPanel` lists active tickets without
 * a dueDate. Dragging a row onto a `DayCell` patches its `dueDate` to
 * the dropped day's local midnight; the calendar grid + panel both
 * refresh from the same `['issues', projectId]` cache key.
 */
export default function CalendarPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cursorMonth, setCursorMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const { filters, setFilters, resetFilters } = useFilterSearchParams()
  const queryClient = useQueryClient()

  const showArchived = getBool(searchParams, ARCHIVED_PARAM, false)
  const setShowArchived = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          setBool(next, ARCHIVED_PARAM, value, false)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const { project, issues: allIssues, total, isLoading } = useCalendarData(
    projectId ?? '',
    cursorMonth,
    { includeArchived: showArchived },
  )
  // Match the Lists convention: the Archived toggle is a *view switch*,
  // not a superset — off shows only active rows (BE already excludes
  // archived via the default), on shows ONLY archived rows. The BE
  // returns active + archived when `includeArchived=true` is sent, so
  // we strip the active rows client-side here.
  const visibleIssues = useMemo(
    () => (showArchived ? allIssues.filter((i) => i.archivedAt != null) : allIssues),
    [allIssues, showArchived],
  )
  const currentUserId = useAuthStore((s) => s.user?.id)

  // Project metadata for the FiltersPopover (labels / components / modules / epics).
  const projectLabelsQuery = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectRepository.listLabels(projectId!),
    enabled: !!projectId,
  })
  const projectComponentsQuery = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId!),
    enabled: !!projectId,
  })
  const tocQuery = useQuery({
    queryKey: ['toc', projectId],
    queryFn: () => issueRepository.findTableOfContent(projectId!),
    enabled: !!projectId,
  })
  const projectModules = useMemo(
    () => tocQuery.data?.domains.map((d) => ({ id: d.id, title: d.title })) ?? [],
    [tocQuery.data],
  )
  const projectEpics = useMemo(() => {
    const fromDomains = tocQuery.data?.domains.flatMap((d) =>
      d.epics.map((e) => ({ id: e.id, title: e.title })),
    ) ?? []
    const orphans =
      tocQuery.data?.orphanEpics.map((e) => ({ id: e.id, title: e.title })) ?? []
    return [...fromDomains, ...orphans]
  }, [tocQuery.data])

  // Unscheduled panel — opens by default; explicit `?unscheduled=0` collapses.
  const unscheduledOpen = !searchParams.has(UNSCHEDULED_PARAM)
    ? true
    : getBool(searchParams, UNSCHEDULED_PARAM, true)

  const toggleUnscheduled = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        setBool(next, UNSCHEDULED_PARAM, !unscheduledOpen, true)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams, unscheduledOpen])

  const { items: unscheduledItems, isLoading: unscheduledLoading } = useUnscheduledIssues(
    projectId ?? '',
    filters,
    unscheduledOpen,
  )

  const { onDragEnd } = useCalendarDnd(projectId ?? '')

  const refreshUnscheduled = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['issues', projectId, 'unscheduled'] })
  }, [queryClient, projectId])

  const { assignedMembers, reviewerMembers, creatorMembers } = useMemo(() => {
    const aMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const rMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const cMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const seed = (issue: Issue) => {
      if (issue.assignee) aMap.set(issue.assignee.id, issue.assignee)
      if (issue.reviewerAssignee) rMap.set(issue.reviewerAssignee.id, issue.reviewerAssignee)
      if (issue.creator) cMap.set(issue.creator.id, issue.creator)
    }
    for (const issue of allIssues) seed(issue)
    for (const issue of unscheduledItems) seed(issue)
    return {
      assignedMembers: [...aMap.values()],
      reviewerMembers: [...rMap.values()],
      creatorMembers: [...cMap.values()],
    }
  }, [allIssues, unscheduledItems])

  // PM-78: search-input operator parsing context. `assignee:me` etc.
  const searchParseCtx = useMemo(
    () => ({
      currentUserId,
      members: assignedMembers,
      labels: projectLabelsQuery.data ?? [],
      modules: projectModules,
      epics: projectEpics,
    }),
    [currentUserId, assignedMembers, projectLabelsQuery.data, projectModules, projectEpics],
  )
  const filteredIssues = useFilteredIssues(visibleIssues, filters, searchParseCtx)

  const toggleAssignee = useCallback(
    (id: string) => setFilters({ assignees: toggleSet(filters.assignees, id) }),
    [filters.assignees, setFilters],
  )

  const goPrev = useCallback(() => {
    setCursorMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }, [])
  const goNext = useCallback(() => {
    setCursorMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }, [])
  const goToday = useCallback(() => {
    const now = new Date()
    setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [])

  const hasFilters = hasActiveFilters(filters)

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        project={project}
        cursorMonth={cursorMonth}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        toggleAssignee={toggleAssignee}
        assignedMembers={assignedMembers}
        reviewerMembers={reviewerMembers}
        creatorMembers={creatorMembers}
        projectLabels={projectLabelsQuery.data ?? []}
        projectComponents={projectComponentsQuery.data ?? []}
        projectModules={projectModules}
        projectEpics={projectEpics}
        hasFilters={hasFilters}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-auto p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
              </div>
            ) : (
              <>
                <EmptyMonthBanner
                  cursorMonth={cursorMonth}
                  total={total}
                  filteredCount={filteredIssues.length}
                  hasFilters={hasFilters}
                  onClearFilters={resetFilters}
                />
                <MonthGrid
                  cursorMonth={cursorMonth}
                  issues={filteredIssues}
                  projectKey={project?.key}
                  onSelectIssue={setSelectedIssue}
                />
              </>
            )}
          </div>

          <UnscheduledPanel
            items={unscheduledItems}
            isLoading={unscheduledLoading}
            collapsed={!unscheduledOpen}
            onToggleCollapse={toggleUnscheduled}
            onRowClick={setSelectedIssue}
            onRefresh={refreshUnscheduled}
            projectKey={project?.key}
          />
        </div>
      </DragDropContext>

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
