import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectRepository } from '@/features/project/repository'
import { componentApi } from '@/features/project/component-api'
import { issueRepository } from '@/features/issue/repository'
import { useAuthStore } from '@/features/auth/store'
import { useTimelineData } from '@/features/timeline/hooks/useTimelineData'
import { useTimelineDateRange } from '@/features/timeline/hooks/useTimelineDateRange'
import { useTimelineGroups } from '@/features/timeline/hooks/useTimelineGroups'
import { useTimelineRows } from '@/features/timeline/hooks/useTimelineRows'
import { useFilteredIssues } from '@/features/timeline/hooks/useFilteredIssues'
import { useTimelineDateDrag } from '@/features/timeline/hooks/useTimelineDateDrag'
import TimelineHeader from '@/features/timeline/components/TimelineHeader'
import TimelineLabelColumn from '@/features/timeline/components/TimelineLabelColumn'
import TimelineChart from '@/features/timeline/components/TimelineChart'
import TimelineTooltip from '@/features/timeline/components/TimelineTooltip'
import { startOfDay, type GroupBy, GROUP_BY_OPTIONS } from '@/features/timeline/lib'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { getEnum, setEnum, PARAM } from '@/shared/lib/filter-codec'
import { hasActiveFilters, toggleSet } from '@/shared/ui/filterState'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import type { Issue } from '@/features/issue/api'
import { Share2 } from 'lucide-react'
import ShareLinkDialog from '@/features/share-link/components/ShareLinkDialog'
import {
  isPmOrAdmin,
  useProjectRole,
} from '@/features/share-link/hooks/useProjectRole'

const LABEL_WIDTH_EXPANDED = 280
const LABEL_WIDTH_COLLAPSED = 48
const ROW_HEIGHT = 36
const LABELS_COLLAPSED_KEY = 'timeline-labels-collapsed'

/**
 * Composition root for the project timeline. All data, filtering, and
 * grouping logic lives in hooks; render is just a header + two columns
 * (labels + chart) + tooltip + detail panel.
 */
export default function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, setFilters, resetFilters } = useFilterSearchParams()

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())
  const [hoveredIssue, setHoveredIssue] = useState<{ id: string; x: number; y: number } | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [labelsCollapsed, setLabelsCollapsed] = useState<boolean>(
    () => localStorage.getItem(LABELS_COLLAPSED_KEY) === 'true',
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  const toggleLabelsCollapsed = useCallback(() => {
    setLabelsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(LABELS_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  const labelWidth = labelsCollapsed ? LABEL_WIDTH_COLLAPSED : LABEL_WIDTH_EXPANDED

  const projectRole = useProjectRole(projectId)
  const canShare = isPmOrAdmin(projectRole)

  const groupBy = getEnum<GroupBy>(searchParams, PARAM.group, GROUP_BY_OPTIONS, 'epic')
  const setGroupBy = useCallback((value: GroupBy) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      setEnum<GroupBy>(next, PARAM.group, value, 'epic')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const { project, issues: allIssues, isLoading } = useTimelineData(projectId ?? '')

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

  const assignedMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string | null }>()
    for (const issue of allIssues) {
      if (issue.assignee) map.set(issue.assignee.id, issue.assignee)
    }
    return [...map.values()]
  }, [allIssues])

  // PM-78: search-input operator parsing context.
  const currentUserId = useAuthStore((s) => s.user?.id)
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
  const filteredIssues = useFilteredIssues(allIssues, filters, searchParseCtx)
  const dateRange = useTimelineDateRange(filteredIssues)
  const { epicGroups, groups } = useTimelineGroups(allIssues, filteredIssues, groupBy, filters.sortStack)
  const rows = useTimelineRows(groupBy, epicGroups, groups, collapsedEpics)

  const dateDrag = useTimelineDateDrag({ projectId: projectId ?? '', dateRange })

  const todayOffset = useMemo(() => {
    const now = startOfDay(new Date())
    const range = dateRange.endDate.getTime() - dateRange.startDate.getTime()
    if (range === 0) return 0
    return ((now.getTime() - dateRange.startDate.getTime()) / range) * 100
  }, [dateRange])

  const toggleEpicCollapse = useCallback((key: string) => {
    setCollapsedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const toggleAssignee = useCallback((id: string) => {
    setFilters({ assignees: toggleSet(filters.assignees, id) })
  }, [filters.assignees, setFilters])

  const handleHover = useCallback((issueId: string | null, e?: React.MouseEvent) => {
    if (!issueId || !e) setHoveredIssue(null)
    else setHoveredIssue({ id: issueId, x: e.clientX, y: e.clientY })
  }, [])

  const hoveredIssueData = useMemo(
    () => (hoveredIssue ? allIssues.find((i) => i.id === hoveredIssue.id) ?? null : null),
    [hoveredIssue, allIssues],
  )

  const hasFilters = hasActiveFilters(filters)

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      <TimelineHeader
        project={project}
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        toggleAssignee={toggleAssignee}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        assignedMembers={assignedMembers}
        projectLabels={projectLabelsQuery.data ?? []}
        projectComponents={projectComponentsQuery.data ?? []}
        projectModules={projectModules}
        projectEpics={projectEpics}
        hasFilters={hasFilters}
        rightActions={canShare ? (
          <button
            type="button"
            onClick={() => setShareDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Create a public share link to this timeline"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        ) : undefined}
      />

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <EmptyState />
        ) : (
          <div ref={scrollRef} className="h-full overflow-auto">
            <div className="flex">
              <TimelineLabelColumn
                rows={rows}
                groupBy={groupBy}
                projectKey={project?.key}
                rowHeight={ROW_HEIGHT}
                width={labelWidth}
                collapsed={labelsCollapsed}
                onToggleCollapsed={toggleLabelsCollapsed}
                onSelectIssue={setSelectedIssue}
                onToggleEpic={toggleEpicCollapse}
              />
              <TimelineChart
                rows={rows}
                dateRange={dateRange}
                todayOffset={todayOffset}
                rowHeight={ROW_HEIGHT}
                onSelectIssue={setSelectedIssue}
                onHover={handleHover}
                drag={dateDrag}
              />
            </div>
          </div>
        )}
      </div>

      {hoveredIssueData && hoveredIssue && (
        <TimelineTooltip issue={hoveredIssueData} projectKey={project?.key} position={{ x: hoveredIssue.x, y: hoveredIssue.y }} />
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

      {canShare && (
        <ShareLinkDialog
          projectId={projectId}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
      <p className="text-lg font-medium">No issues to display</p>
      <p className="text-sm">Try adjusting your filters or create some issues first.</p>
    </div>
  )
}
