import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { issueApi, type Issue } from '@/api/issues'
import { projectApi } from '@/api/projects'
import IssueDetailPanel from '@/components/issue/IssueDetailPanel'
import { SearchInput, DropdownFilters, AssigneeAvatars, FilterDivider, ClearFiltersButton, toggleSet } from '@/components/filter/FilterBar'
import { STATUS_COLORS, STATUS_LABELS, TYPE_ICONS } from '@/lib/constants'
import { cn } from '@/lib/utils'

type GroupBy = 'type' | 'assignee'

const STATUS_BAR_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400/80',
  TODO: 'bg-blue-400/80',
  IN_PROGRESS: 'bg-yellow-400/80',
  REVIEW_QA: 'bg-purple-400/80',
  DONE: 'bg-green-400/80',
  CANCELED: 'bg-red-400/80',
  RECHECK: 'bg-orange-400/80',
}

const DAY_MS = 86400000

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

function formatWeek(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('type')
  const [hoveredIssue, setHoveredIssue] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set())

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: issuesData, isLoading } = useQuery({
    queryKey: ['issues', projectId, 'timeline'],
    queryFn: () => issueApi.list(projectId!, { limit: '200' }),
    enabled: !!projectId,
  })

  const allIssues = issuesData?.items || []

  // Extract unique assignees for filter
  const assignedMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    allIssues.forEach((issue) => {
      if (issue.assignee) memberMap.set(issue.assignee.id, issue.assignee)
    })
    return [...memberMap.values()]
  }, [allIssues])

  // Apply filters
  const filteredIssues = useMemo(() => {
    const searchLower = search.toLowerCase()
    return allIssues.filter((issue) => {
      if (filterStatus && issue.status !== filterStatus) return false
      if (filterPriority && issue.priority !== filterPriority) return false
      if (filterType && issue.type !== filterType) return false
      if (selectedAssignees.size > 0 && (!issue.assigneeId || !selectedAssignees.has(issue.assigneeId))) return false
      if (search && !issue.title.toLowerCase().includes(searchLower) && !String(issue.number).includes(search)) return false
      return true
    })
  }, [allIssues, filterStatus, filterPriority, filterType, selectedAssignees, search])

  // Calculate date range
  const { startDate, endDate, totalDays, weeks } = useMemo(() => {
    const now = startOfDay(new Date())
    let earliest = now
    let latest = new Date(now.getTime() + 30 * DAY_MS)

    filteredIssues.forEach((issue) => {
      const created = startOfDay(new Date(issue.createdAt))
      if (created < earliest) earliest = created
      if (issue.dueDate) {
        const due = startOfDay(new Date(issue.dueDate))
        if (due > latest) latest = due
      }
    })

    // Add padding: 7 days before and 14 days after
    const start = new Date(earliest.getTime() - 7 * DAY_MS)
    const end = new Date(latest.getTime() + 14 * DAY_MS)
    const total = Math.ceil((end.getTime() - start.getTime()) / DAY_MS)

    // Generate week markers
    const weekMarkers: { date: Date; offset: number }[] = []
    const cur = new Date(start)
    // Align to Monday
    const dayOfWeek = cur.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    cur.setDate(cur.getDate() + daysToMonday)
    while (cur <= end) {
      const offset = (cur.getTime() - start.getTime()) / (end.getTime() - start.getTime()) * 100
      weekMarkers.push({ date: new Date(cur), offset })
      cur.setDate(cur.getDate() + 7)
    }

    return { startDate: start, endDate: end, totalDays: total, weeks: weekMarkers }
  }, [filteredIssues])

  // Group issues
  const groups = useMemo(() => {
    const grouped = new Map<string, Issue[]>()

    if (groupBy === 'type') {
      const typeOrder = ['EPIC', 'TASK', 'BUG', 'SUB_TASK']
      typeOrder.forEach((t) => grouped.set(t, []))
      filteredIssues.forEach((issue) => {
        const list = grouped.get(issue.type) || []
        list.push(issue)
        grouped.set(issue.type, list)
      })
    } else {
      // Group by assignee
      filteredIssues.forEach((issue) => {
        const key = issue.assignee?.name || 'Unassigned'
        const list = grouped.get(key) || []
        list.push(issue)
        grouped.set(key, list)
      })
      // Sort: "Unassigned" last
      if (grouped.has('Unassigned')) {
        const unassigned = grouped.get('Unassigned')!
        grouped.delete('Unassigned')
        grouped.set('Unassigned', unassigned)
      }
    }

    // Remove empty groups
    for (const [key, items] of grouped) {
      if (items.length === 0) grouped.delete(key)
    }

    return grouped
  }, [filteredIssues, groupBy])

  // Today marker position
  const todayOffset = useMemo(() => {
    const now = startOfDay(new Date())
    const range = endDate.getTime() - startDate.getTime()
    if (range === 0) return 0
    return ((now.getTime() - startDate.getTime()) / range) * 100
  }, [startDate, endDate])

  const getBarStyle = useCallback(
    (issue: Issue) => {
      const range = endDate.getTime() - startDate.getTime()
      if (range === 0) return { left: '0%', width: '2px' }

      const created = startOfDay(new Date(issue.createdAt))
      const leftPct = ((created.getTime() - startDate.getTime()) / range) * 100

      if (!issue.dueDate) {
        // Dot (no due date) - render as a small marker
        return { left: `${Math.max(0, Math.min(leftPct, 99.5))}%`, width: '8px', minWidth: '8px' }
      }

      const due = startOfDay(new Date(issue.dueDate))
      const widthPct = ((due.getTime() - created.getTime()) / range) * 100

      return {
        left: `${Math.max(0, leftPct)}%`,
        width: `${Math.max(0.3, widthPct)}%`,
        minWidth: '12px',
      }
    },
    [startDate, endDate],
  )

  const handleBarMouseEnter = useCallback((e: React.MouseEvent, issueId: string) => {
    setHoveredIssue(issueId)
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleBarMouseLeave = useCallback(() => {
    setHoveredIssue(null)
    setTooltipPos(null)
  }, [])

  const toggleAssignee = useCallback((id: string) => {
    setSelectedAssignees((prev) => toggleSet(prev, id))
  }, [])

  const hasFilters = search || filterStatus || filterPriority || filterType || selectedAssignees.size > 0

  const hoveredIssueData = useMemo(() => {
    if (!hoveredIssue) return null
    return allIssues.find((i) => i.id === hoveredIssue) || null
  }, [hoveredIssue, allIssues])

  if (!projectId) return null

  // Column widths
  const LABEL_WIDTH = 280
  const ROW_HEIGHT = 36

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{project?.key} Timeline</h1>
          <p className="text-sm text-gray-500">{project?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Group by toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-300 p-0.5">
            <button
              onClick={() => setGroupBy('type')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                groupBy === 'type' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              By Type
            </button>
            <button
              onClick={() => setGroupBy('assignee')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                groupBy === 'assignee' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              By Assignee
            </button>
          </div>
          <FilterDivider />
          <SearchInput value={search} onChange={setSearch} />
          <DropdownFilters
            status={filterStatus}
            priority={filterPriority}
            type={filterType}
            onStatusChange={setFilterStatus}
            onPriorityChange={setFilterPriority}
            onTypeChange={setFilterType}
          />
          <FilterDivider />
          <AssigneeAvatars members={assignedMembers} selected={selectedAssignees} onToggle={toggleAssignee} />
          {hasFilters && (
            <ClearFiltersButton
              onClick={() => {
                setSearch('')
                setFilterStatus('')
                setFilterPriority('')
                setFilterType('')
                setSelectedAssignees(new Set())
              }}
            />
          )}
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <p className="text-lg font-medium">No issues to display</p>
            <p className="text-sm">Try adjusting your filters or create some issues first.</p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left: Issue labels (fixed) */}
            <div
              className="shrink-0 overflow-y-auto border-r border-gray-200 bg-white"
              style={{ width: LABEL_WIDTH }}
            >
              {/* Header spacer */}
              <div className="h-10 border-b border-gray-200 bg-gray-50 px-3 flex items-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issues</span>
              </div>
              {/* Issue rows */}
              {[...groups.entries()].map(([groupName, issues]) => (
                <div key={groupName}>
                  {/* Group header */}
                  <div
                    className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-3"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {groupBy === 'type' ? `${TYPE_ICONS[groupName] || ''} ${groupName.replace(/_/g, ' ')}` : groupName}
                    </span>
                    <span className="text-xs text-gray-400">({issues.length})</span>
                  </div>
                  {/* Issue rows */}
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="flex items-center border-b border-gray-100 px-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <div className={cn('h-2 w-2 shrink-0 rounded-full mr-2', STATUS_COLORS[issue.status])} />
                      <span className="text-xs font-mono text-gray-400 mr-1.5 shrink-0">
                        {project?.key}-{issue.number}
                      </span>
                      <span className="text-sm text-gray-700 truncate">{issue.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Right: Timeline chart (scrollable) */}
            <div className="flex-1 overflow-auto" ref={scrollRef}>
              <div className="relative" style={{ minWidth: Math.max(800, totalDays * 12) }}>
                {/* Week headers */}
                <div className="sticky top-0 z-10 h-10 border-b border-gray-200 bg-gray-50">
                  {weeks.map((week, i) => (
                    <div
                      key={i}
                      className="absolute top-0 flex h-full items-center"
                      style={{ left: `${week.offset}%` }}
                    >
                      <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap pl-1">
                        {formatWeek(week.date)}
                      </span>
                    </div>
                  ))}
                  {/* Today label */}
                  {todayOffset >= 0 && todayOffset <= 100 && (
                    <div
                      className="absolute top-0 flex h-full items-end pb-0.5"
                      style={{ left: `${todayOffset}%` }}
                    >
                      <span className="text-[10px] font-bold text-red-500 whitespace-nowrap -translate-x-1/2">
                        Today
                      </span>
                    </div>
                  )}
                </div>

                {/* Rows with bars */}
                {[...groups.entries()].map(([groupName, issues]) => (
                  <div key={groupName}>
                    {/* Group header row */}
                    <div
                      className="relative border-b border-gray-100 bg-gray-50/80"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Vertical week lines in group header */}
                      {weeks.map((week, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full w-px bg-gray-200/60"
                          style={{ left: `${week.offset}%` }}
                        />
                      ))}
                    </div>

                    {/* Issue bar rows */}
                    {issues.map((issue) => {
                      const barStyle = getBarStyle(issue)
                      const isDot = !issue.dueDate
                      return (
                        <div
                          key={issue.id}
                          className="relative border-b border-gray-100"
                          style={{ height: ROW_HEIGHT }}
                        >
                          {/* Vertical week lines */}
                          {weeks.map((week, i) => (
                            <div
                              key={i}
                              className="absolute top-0 h-full w-px bg-gray-100"
                              style={{ left: `${week.offset}%` }}
                            />
                          ))}

                          {/* Today marker */}
                          {todayOffset >= 0 && todayOffset <= 100 && (
                            <div
                              className="absolute top-0 h-full w-px bg-red-400 z-[1]"
                              style={{ left: `${todayOffset}%` }}
                            />
                          )}

                          {/* Issue bar */}
                          <div
                            className={cn(
                              'absolute top-1/2 -translate-y-1/2 cursor-pointer transition-all hover:brightness-110 hover:shadow-md z-[2]',
                              isDot ? 'rounded-full h-3' : 'rounded-md h-5',
                              STATUS_BAR_COLORS[issue.status] || 'bg-gray-400/80',
                            )}
                            style={{
                              left: barStyle.left,
                              width: barStyle.width,
                              minWidth: barStyle.minWidth,
                            }}
                            onClick={() => setSelectedIssue(issue)}
                            onMouseEnter={(e) => handleBarMouseEnter(e, issue.id)}
                            onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                            onMouseLeave={handleBarMouseLeave}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Today line spanning full height */}
                {todayOffset >= 0 && todayOffset <= 100 && (
                  <div
                    className="absolute top-10 bottom-0 w-px bg-red-400/50 z-[1] pointer-events-none"
                    style={{ left: `${todayOffset}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hoveredIssueData && tooltipPos && (
        <div
          className="fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
        >
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[hoveredIssueData.status])} />
            <span className="text-xs font-mono text-gray-400">
              {project?.key}-{hoveredIssueData.number}
            </span>
            <span className="text-xs font-medium text-gray-900 max-w-[240px] truncate">
              {hoveredIssueData.title}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500">
            <span>{STATUS_LABELS[hoveredIssueData.status] || hoveredIssueData.status}</span>
            <span>{hoveredIssueData.priority}</span>
            {hoveredIssueData.assignee && (
              <span className="flex items-center gap-1">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary-100 text-[8px] font-medium text-primary-700">
                  {hoveredIssueData.assignee.name.charAt(0).toUpperCase()}
                </span>
                {hoveredIssueData.assignee.name}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-400">
            {formatDate(new Date(hoveredIssueData.createdAt))}
            {hoveredIssueData.dueDate && ` — ${formatDate(new Date(hoveredIssueData.dueDate))}`}
            {!hoveredIssueData.dueDate && ' (no due date)'}
          </div>
        </div>
      )}

      {/* Issue Detail Panel */}
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
