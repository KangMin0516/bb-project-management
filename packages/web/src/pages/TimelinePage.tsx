import { useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { issueApi, type Issue } from '@/api/issues'
import { projectApi } from '@/api/projects'
import IssueDetailPanel from '@/components/issue/IssueDetailPanel'
import { SearchInput, DropdownFilters, AssigneeAvatars, FilterDivider, ClearFiltersButton, toggleSet } from '@/components/filter/FilterBar'
import { useFilterSearchParams } from '@/hooks/useFilterSearchParams'
import { getEnum, setEnum, PARAM } from '@/lib/filter-codec'
import { STATUS_COLORS, STATUS_BAR_COLORS, STATUS_LABELS, TYPE_ICONS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

type GroupBy = 'epic' | 'type' | 'assignee'
const GROUP_BY_OPTIONS = ['epic', 'type', 'assignee'] as const

const NO_EPIC_KEY = '__no_epic__'

type EpicGroup = {
  key: string
  epic: Issue | null
  children: Issue[]
}

const DAY_MS = 86400000

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, setFilters, setFiltersFull, resetFilters } = useFilterSearchParams()

  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const groupBy = getEnum<GroupBy>(searchParams, PARAM.group, GROUP_BY_OPTIONS, 'epic')
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())
  const [hoveredIssue, setHoveredIssue] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const setGroupBy = useCallback(
    (value: GroupBy) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          setEnum<GroupBy>(next, PARAM.group, value, 'epic')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  // Alias the FilterState fields the page reads to keep the diff small.
  const { search, status: filterStatus, priority: filterPriority, type: filterType, assignees: selectedAssignees } = filters
  const setSearch = useCallback((v: string) => setFilters({ search: v }), [setFilters])
  const setFilterStatus = useCallback((v: Set<string>) => setFilters({ status: v }), [setFilters])
  const setFilterPriority = useCallback((v: Set<string>) => setFilters({ priority: v }), [setFilters])
  const setFilterType = useCallback((v: Set<string>) => setFilters({ type: v }), [setFilters])
  const setSelectedAssignees = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setFiltersFull((prev) => ({
        ...prev,
        assignees:
          typeof updater === 'function'
            ? (updater as (p: Set<string>) => Set<string>)(prev.assignees)
            : updater,
      }))
    },
    [setFiltersFull],
  )

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
      // Hide CANCELED unless user explicitly opts in via the Status filter
      if (issue.status === 'CANCELED' && !filterStatus.has('CANCELED')) return false
      if (filterStatus.size > 0 && !filterStatus.has(issue.status)) return false
      if (filterPriority.size > 0 && !filterPriority.has(issue.priority)) return false
      if (filterType.size > 0 && !filterType.has(issue.type)) return false
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
      const begin = startOfDay(new Date(issue.startDate ?? issue.createdAt))
      if (begin < earliest) earliest = begin
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

  // Lookup table for parent traversal (includes filtered-out issues so EPIC linkage survives filters)
  const issueMap = useMemo(() => {
    const map = new Map<string, Issue>()
    for (const issue of allIssues) map.set(issue.id, issue)
    return map
  }, [allIssues])

  // EPIC-mode grouping: walk parentId chain to find ancestor EPIC
  const epicGroups = useMemo<EpicGroup[]>(() => {
    if (groupBy !== 'epic') return []
    const groupMap = new Map<string, EpicGroup>()

    // Pre-create groups for every EPIC visible after filtering
    for (const issue of filteredIssues) {
      if (issue.type === 'EPIC' && !groupMap.has(issue.id)) {
        groupMap.set(issue.id, { key: issue.id, epic: issue, children: [] })
      }
    }

    // Assign non-EPIC issues to their nearest ancestor EPIC
    for (const issue of filteredIssues) {
      if (issue.type === 'EPIC') continue
      let cur: Issue | undefined = issue
      let foundEpicId: string | null = null
      const seen = new Set<string>()
      while (cur && cur.parentId && !seen.has(cur.parentId)) {
        seen.add(cur.parentId)
        const parent = issueMap.get(cur.parentId)
        if (!parent) break
        if (parent.type === 'EPIC') {
          foundEpicId = parent.id
          break
        }
        cur = parent
      }
      if (foundEpicId) {
        let g = groupMap.get(foundEpicId)
        if (!g) {
          // EPIC exists in dataset but got filtered out — still surface its bucket
          const epic = issueMap.get(foundEpicId) ?? null
          g = { key: foundEpicId, epic, children: [] }
          groupMap.set(foundEpicId, g)
        }
        g.children.push(issue)
      } else {
        if (!groupMap.has(NO_EPIC_KEY)) {
          groupMap.set(NO_EPIC_KEY, { key: NO_EPIC_KEY, epic: null, children: [] })
        }
        groupMap.get(NO_EPIC_KEY)!.children.push(issue)
      }
    }

    // Drop empty EPIC groups (epic visible but no children AND epic filtered out somehow)
    const ordered = [...groupMap.values()].filter((g) => g.epic || g.children.length > 0)

    // EPIC groups first by createdAt asc; "No Epic" bucket last
    ordered.sort((a, b) => {
      if (a.key === NO_EPIC_KEY) return 1
      if (b.key === NO_EPIC_KEY) return -1
      const at = a.epic ? new Date(a.epic.createdAt).getTime() : 0
      const bt = b.epic ? new Date(b.epic.createdAt).getTime() : 0
      return at - bt
    })

    for (const g of ordered) {
      g.children.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    }
    return ordered
  }, [filteredIssues, issueMap, groupBy])

  const toggleEpicCollapse = useCallback((key: string) => {
    setCollapsedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Group issues (for 'type' and 'assignee' modes; 'epic' uses epicGroups instead)
  const groups = useMemo(() => {
    const grouped = new Map<string, Issue[]>()
    if (groupBy === 'epic') return grouped

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

      // Bar start = planned startDate if set, else falls back to createdAt
      const begin = startOfDay(new Date(issue.startDate ?? issue.createdAt))
      const leftPct = ((begin.getTime() - startDate.getTime()) / range) * 100

      // If neither startDate nor dueDate is set → dot (placeholder)
      if (!issue.dueDate && !issue.startDate) {
        return { left: `${Math.max(0, Math.min(leftPct, 99.5))}%`, width: '8px', minWidth: '8px' }
      }

      // If only startDate is set (no dueDate), draw a thin bar from start of width 8px-ish
      if (!issue.dueDate) {
        return { left: `${Math.max(0, leftPct)}%`, width: '8px', minWidth: '8px' }
      }

      const due = startOfDay(new Date(issue.dueDate))
      const widthPct = ((due.getTime() - begin.getTime()) / range) * 100

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

  const hasFilters = search || filterStatus.size > 0 || filterPriority.size > 0 || filterType.size > 0 || selectedAssignees.size > 0

  const hoveredIssueData = useMemo(() => {
    if (!hoveredIssue) return null
    return allIssues.find((i) => i.id === hoveredIssue) || null
  }, [hoveredIssue, allIssues])

  if (!projectId) return null

  // Column widths
  const LABEL_WIDTH = 280
  const ROW_HEIGHT = 36

  type TimelineRow =
    | { kind: 'epic'; epic: Issue; childCount: number; collapsed: boolean }
    | { kind: 'no-epic'; childCount: number; collapsed: boolean }
    | { kind: 'group'; label: string; count: number }
    | { kind: 'issue'; issue: Issue; indent: number }

  const displayRows: TimelineRow[] = (() => {
    const rows: TimelineRow[] = []
    if (groupBy === 'epic') {
      for (const g of epicGroups) {
        const collapseKey = g.epic ? g.epic.id : NO_EPIC_KEY
        const collapsed = collapsedEpics.has(collapseKey)
        if (g.epic) {
          rows.push({ kind: 'epic', epic: g.epic, childCount: g.children.length, collapsed })
        } else {
          rows.push({ kind: 'no-epic', childCount: g.children.length, collapsed })
        }
        if (!collapsed) {
          for (const issue of g.children) rows.push({ kind: 'issue', issue, indent: 1 })
        }
      }
    } else {
      for (const [label, items] of groups) {
        rows.push({ kind: 'group', label, count: items.length })
        for (const issue of items) rows.push({ kind: 'issue', issue, indent: 0 })
      }
    }
    return rows
  })()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{project?.key} Timeline</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Group by toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 p-0.5">
            <button
              onClick={() => setGroupBy('epic')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                groupBy === 'epic' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
              )}
            >
              By Epic
            </button>
            <button
              onClick={() => setGroupBy('type')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                groupBy === 'type' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
              )}
            >
              By Type
            </button>
            <button
              onClick={() => setGroupBy('assignee')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                groupBy === 'assignee' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
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
              onClick={resetFilters}
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
          <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <p className="text-lg font-medium">No issues to display</p>
            <p className="text-sm">Try adjusting your filters or create some issues first.</p>
          </div>
        ) : (
          <div ref={scrollRef} className="h-full overflow-auto">
            <div className="flex">
            {/* Left: Issue labels (vertical scroll inherited from outer; sticky-left when chart scrolls horizontally) */}
            <div
              className="shrink-0 sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              style={{ width: LABEL_WIDTH }}
            >
              {/* Header spacer — stays at top during vertical scroll */}
              <div className="sticky top-0 z-20 h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 flex items-center">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Issues</span>
              </div>
              {/* Rows */}
              {displayRows.map((row, idx) => {
                if (row.kind === 'group') {
                  return (
                    <div
                      key={`group-${row.label}-${idx}`}
                      className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-3"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {groupBy === 'type' ? `${TYPE_ICONS[row.label] || ''} ${row.label.replace(/_/g, ' ')}` : row.label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">({row.count})</span>
                    </div>
                  )
                }
                if (row.kind === 'no-epic') {
                  const Chev = row.collapsed ? ChevronRight : ChevronDown
                  return (
                    <button
                      key={`no-epic-${idx}`}
                      onClick={() => toggleEpicCollapse(NO_EPIC_KEY)}
                      className="flex w-full items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 px-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <Chev className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        No Epic
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">({row.childCount})</span>
                    </button>
                  )
                }
                if (row.kind === 'epic') {
                  const Chev = row.collapsed ? ChevronRight : ChevronDown
                  const e = row.epic
                  return (
                    <div
                      key={`epic-${e.id}`}
                      className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 bg-primary-50/40 dark:bg-primary-900/20 px-1.5 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => setSelectedIssue(e)}
                    >
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggleEpicCollapse(e.id) }}
                        className="shrink-0 rounded p-0.5 hover:bg-primary-100 dark:hover:bg-primary-800/40"
                      >
                        <Chev className="h-3.5 w-3.5 text-primary-700 dark:text-primary-300" />
                      </button>
                      <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[e.status])} />
                      <span className="text-xs font-mono text-primary-700 dark:text-primary-300 shrink-0">
                        {project?.key}-{e.number}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex-1">{e.title}</span>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 shrink-0">{row.childCount}</span>
                    </div>
                  )
                }
                // issue row
                const issue = row.issue
                return (
                  <div
                    key={issue.id}
                    className="flex items-center border-b border-gray-100 dark:border-gray-700 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    style={{ height: ROW_HEIGHT, paddingLeft: 12 + row.indent * 18 }}
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <div className={cn('h-2 w-2 shrink-0 rounded-full mr-2', STATUS_COLORS[issue.status])} />
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mr-1.5 shrink-0">
                      {project?.key}-{issue.number}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{issue.title}</span>
                  </div>
                )
              })}
            </div>

            {/* Right: Timeline chart — flexes; minWidth on inner triggers outer's horizontal scroll */}
            <div className="flex-1 min-w-0">
              <div className="relative" style={{ minWidth: Math.max(800, totalDays * 12) }}>
                {/* Week headers */}
                <div className="sticky top-0 z-10 h-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  {weeks.map((week, i) => (
                    <div
                      key={i}
                      className="absolute top-0 flex h-full items-center"
                      style={{ left: `${week.offset}%` }}
                    >
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap pl-1">
                        {formatDate(week.date)}
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

                {/* Rows with bars (mirrors displayRows from the left panel) */}
                {displayRows.map((row, idx) => {
                  // Plain header row (group / no-epic) — gray, no bar
                  if (row.kind === 'group' || row.kind === 'no-epic') {
                    return (
                      <div
                        key={`hdr-${idx}`}
                        className="relative border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {weeks.map((week, i) => (
                          <div
                            key={i}
                            className="absolute top-0 h-full w-px bg-gray-200 dark:bg-gray-600/60"
                            style={{ left: `${week.offset}%` }}
                          />
                        ))}
                      </div>
                    )
                  }

                  // EPIC row — render with epic's own bar, stronger styling
                  if (row.kind === 'epic') {
                    const epic = row.epic
                    const barStyle = getBarStyle(epic)
                    const isDot = !epic.dueDate
                    return (
                      <div
                        key={`epicrow-${epic.id}`}
                        className="relative border-b border-gray-200 dark:border-gray-700 bg-primary-50/40 dark:bg-primary-900/20"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {weeks.map((week, i) => (
                          <div
                            key={i}
                            className="absolute top-0 h-full w-px bg-gray-200 dark:bg-gray-600/60"
                            style={{ left: `${week.offset}%` }}
                          />
                        ))}
                        {todayOffset >= 0 && todayOffset <= 100 && (
                          <div
                            className="absolute top-0 h-full w-px bg-red-400 z-[1]"
                            style={{ left: `${todayOffset}%` }}
                          />
                        )}
                        <div
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 cursor-pointer transition-all hover:brightness-110 hover:shadow-md z-[2] ring-1 ring-primary-300 dark:ring-primary-600',
                            isDot ? 'rounded-full h-3.5' : 'rounded-md h-5',
                            STATUS_BAR_COLORS[epic.status] || 'bg-gray-400/80',
                          )}
                          style={{
                            left: barStyle.left,
                            width: barStyle.width,
                            minWidth: barStyle.minWidth,
                          }}
                          onClick={() => setSelectedIssue(epic)}
                          onMouseEnter={(e) => handleBarMouseEnter(e, epic.id)}
                          onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                          onMouseLeave={handleBarMouseLeave}
                        />
                      </div>
                    )
                  }

                  // Regular issue bar row
                  const issue = row.issue
                  const barStyle = getBarStyle(issue)
                  const isDot = !issue.dueDate
                  return (
                    <div
                      key={issue.id}
                      className="relative border-b border-gray-100 dark:border-gray-700"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {weeks.map((week, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full w-px bg-gray-100 dark:bg-gray-700"
                          style={{ left: `${week.offset}%` }}
                        />
                      ))}
                      {todayOffset >= 0 && todayOffset <= 100 && (
                        <div
                          className="absolute top-0 h-full w-px bg-red-400 z-[1]"
                          style={{ left: `${todayOffset}%` }}
                        />
                      )}
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
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hoveredIssueData && tooltipPos && (
        <div
          className="fixed z-50 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg dark:shadow-gray-900/50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
        >
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[hoveredIssueData.status])} />
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
              {project?.key}-{hoveredIssueData.number}
            </span>
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 max-w-[240px] truncate">
              {hoveredIssueData.title}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
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
          <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
            {formatDate(new Date(hoveredIssueData.startDate ?? hoveredIssueData.createdAt))}
            {hoveredIssueData.dueDate && ` — ${formatDate(new Date(hoveredIssueData.dueDate))}`}
            {!hoveredIssueData.startDate && !hoveredIssueData.dueDate && ' (no dates set)'}
            {hoveredIssueData.startDate && !hoveredIssueData.dueDate && ' (no due date)'}
            {!hoveredIssueData.startDate && hoveredIssueData.dueDate && ' (no start date)'}
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
