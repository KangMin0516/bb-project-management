import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCalendarData } from '@/features/calendar/hooks/useCalendarData'
import { useFilteredIssues } from '@/features/timeline/hooks/useFilteredIssues'
import { useFilterSearchParams } from '@/shared/lib/useFilterSearchParams'
import { toggleSet } from '@/shared/ui/filterState'
import CalendarHeader from '@/features/calendar/components/CalendarHeader'
import EmptyMonthBanner from '@/features/calendar/components/EmptyMonthBanner'
import MonthGrid from '@/features/calendar/components/MonthGrid'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'
import type { Issue } from '@/features/issue/api'

/**
 * Composition root for the project calendar. Month grid of dueDate-pinned
 * issues. Reuses the Timeline page's `useFilteredIssues` (project-agnostic,
 * filter-state-shaped) and the Board's shared FilterBar primitives so all
 * three views feel identical to the user.
 */
export default function CalendarPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [cursorMonth, setCursorMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const { filters, setFilters, resetFilters } = useFilterSearchParams()

  const { project, issues: allIssues, total, isLoading } = useCalendarData(
    projectId ?? '',
    cursorMonth,
  )
  const filteredIssues = useFilteredIssues(allIssues, filters)

  const assignedMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string | null }>()
    for (const issue of allIssues) {
      if (issue.assignee) map.set(issue.assignee.id, issue.assignee)
    }
    return [...map.values()]
  }, [allIssues])

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

  const hasFilters = !!(
    filters.search ||
    filters.status.size ||
    filters.priority.size ||
    filters.type.size ||
    filters.assignees.size
  )

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
        hasFilters={hasFilters}
      />

      <div className="flex flex-1 min-h-0 flex-col overflow-auto p-4">
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
