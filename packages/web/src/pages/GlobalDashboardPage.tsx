import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, type GlobalIssue } from '@/features/dashboard/api'
import { issueApi } from '@/features/issue/api'
import { cn } from '@/shared/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, PRIORITY_ORDER, TYPE_ICONS } from '@/shared/config/constants'
import { getDueBadge, isOverdue, todayDateString, isFocusToday } from '@/shared/lib/time'
import { Star, Zap, Clock, AlertTriangle, FolderKanban } from 'lucide-react'

export default function GlobalDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sortMode, setSortMode] = useState<'dueDate' | 'priority'>('dueDate')
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['global-dashboard'],
    queryFn: dashboardApi.getMyDashboard,
  })

  const toggleFocusMutation = useMutation({
    mutationFn: ({ projectId, issueId, focusDate }: { projectId: string; issueId: string; focusDate: string | null }) =>
      issueApi.update(projectId, issueId, { focusDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-dashboard'] })
    },
  })

  const focusIssues = data?.focusIssues ?? []
  const myIssues = data?.myIssues ?? []
  const overdueIssues = data?.overdueIssues ?? []
  const projects = data?.projects ?? []

  const workingNow = useMemo(() => focusIssues.filter((i) => i.status === 'IN_PROGRESS'), [focusIssues])
  const plannedToday = useMemo(() => focusIssues.filter((i) => i.status !== 'IN_PROGRESS'), [focusIssues])

  const filteredIssues = useMemo(() => {
    const issues = projectFilter === 'all' ? myIssues : myIssues.filter((i) => i.project.id === projectFilter)
    if (sortMode === 'priority') {
      return [...issues].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    }
    return issues
  }, [myIssues, projectFilter, sortMode])

  const groupedIssues = useMemo(() => {
    const groups = new Map<string, { project: { id: string; name: string; key: string }; issues: GlobalIssue[] }>()
    for (const issue of filteredIssues) {
      const key = issue.project.id
      if (!groups.has(key)) {
        groups.set(key, { project: issue.project, issues: [] })
      }
      groups.get(key)!.issues.push(issue)
    }
    return [...groups.values()]
  }, [filteredIssues])

  const overdueCount = useMemo(
    () => [...focusIssues, ...myIssues].filter((i) => isOverdue(i.dueDate)).length,
    [focusIssues, myIssues],
  )

  const handleToggleFocus = (issue: GlobalIssue) => {
    const isCurrentlyFocused = isFocusToday(issue.focusDate)
    toggleFocusMutation.mutate({
      projectId: issue.projectId,
      issueId: issue.id,
      focusDate: isCurrentlyFocused ? null : todayDateString(),
    })
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">My Dashboard</h1>

      {/* Top row: Today's Focus + Overdue Alert */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Focus */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Focus</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              {focusIssues.length}
            </span>
          </div>

          {focusIssues.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
              Click the star on any issue below to add it to today's focus
            </p>
          ) : (
            <div className="space-y-3">
              {workingNow.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-blue-700">Working Now</span>
                  </div>
                  <div className="space-y-1">
                    {workingNow.map((issue) => (
                      <GlobalIssueRow
                        key={issue.id}
                        issue={issue}
                        focused={true}
                        onToggleFocus={handleToggleFocus}
                        onClick={() => navigate(`/projects/${issue.project.key}/board?open=${issue.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {plannedToday.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Planned Today</span>
                  </div>
                  <div className="space-y-1">
                    {plannedToday.map((issue) => (
                      <GlobalIssueRow
                        key={issue.id}
                        issue={issue}
                        focused={true}
                        onToggleFocus={handleToggleFocus}
                        onClick={() => navigate(`/projects/${issue.project.key}/board?open=${issue.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Overdue Alert */}
        <div className={cn(
          'rounded-xl border p-5',
          overdueIssues.length > 0 ? 'border-red-200 bg-red-50/50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
        )}>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className={cn('h-4 w-4', overdueIssues.length > 0 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500')} />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Overdue</h2>
            {overdueCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                {overdueCount}
              </span>
            )}
          </div>

          {overdueIssues.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No overdue issues</p>
          ) : (
            <div className="space-y-1">
              {overdueIssues.map((issue) => {
                const badge = getDueBadge(issue.dueDate)
                return (
                  <div
                    key={issue.id}
                    onClick={() => navigate(`/projects/${issue.project.key}/board?open=${issue.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-red-100/50"
                  >
                    <span className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                      {issue.project.key}
                    </span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">#{issue.number}</span>
                    <span className="flex-1 truncate text-sm font-medium text-red-700">{issue.title}</span>
                    {badge && (
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
                        {badge.text}
                      </span>
                    )}
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                      {issue.priority}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* My Issues — grouped by project */}
      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            My Issues ({filteredIssues.length})
          </h2>
          <div className="flex items-center gap-3">
            {/* Project filter tabs */}
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
              <button
                onClick={() => setProjectFilter('all')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition',
                  projectFilter === 'all' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
                )}
              >
                All
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjectFilter(p.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition',
                    projectFilter === p.id ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
                  )}
                >
                  {p.key}
                </button>
              ))}
            </div>
            {/* Sort toggle */}
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
              {([['dueDate', 'Due Date'], ['priority', 'Priority']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortMode(key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition',
                    sortMode === key ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No issues assigned to you</p>
        ) : (
          <div className="space-y-4">
            {groupedIssues.map((group) => (
              <div key={group.project.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <FolderKanban className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {group.project.key} — {group.project.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({group.issues.length})</span>
                </div>
                <div className="space-y-1">
                  {group.issues.map((issue) => (
                    <GlobalIssueRow
                      key={issue.id}
                      issue={issue}
                      focused={isFocusToday(issue.focusDate)}
                      onToggleFocus={handleToggleFocus}
                      onClick={() => navigate(`/projects/${issue.project.key}/board?open=${issue.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Summary Cards */}
      {projects.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Projects</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const completionRate = p.totalIssues ? Math.round((p.doneIssues / p.totalIssues) * 100) : 0
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.key}`)}
                  className="cursor-pointer rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition hover:border-primary-300 hover:shadow-sm"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">{p.key}</span>
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{p.totalIssues} issues</span>
                    <span>{completionRate}% done</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-green-500 transition-all"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  {p.myIssueCount > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{p.myIssueCount}</span> assigned to you
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function GlobalIssueRow({
  issue,
  focused,
  onToggleFocus,
  onClick,
}: {
  issue: GlobalIssue
  focused: boolean
  onToggleFocus: (issue: GlobalIssue) => void
  onClick: () => void
}) {
  const badge = getDueBadge(issue.dueDate)
  const overdue = !focused && isOverdue(issue.dueDate)
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2',
        focused ? 'bg-gray-50 dark:bg-gray-900' : 'hover:bg-gray-50 dark:bg-gray-900',
        overdue && 'bg-red-50/50',
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFocus(issue) }}
        className={cn(
          'transition',
          focused ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400',
        )}
        title={focused ? "Remove from today's focus" : "Add to today's focus"}
      >
        <Star className={cn('h-3.5 w-3.5', focused && 'fill-current')} />
      </button>
      <span className="text-xs">{TYPE_ICONS[issue.type] || ''}</span>
      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
        {issue.project.key}-{issue.number}
      </span>
      <span
        onClick={onClick}
        className={cn(
          'flex-1 cursor-pointer truncate text-sm font-medium hover:text-primary-700',
          overdue ? 'text-red-700' : 'text-gray-900 dark:text-gray-100',
        )}
      >
        {issue.title}
      </span>
      {badge && (
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
          {badge.text}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{issue.status.replace(/_/g, ' ')}</span>
      </div>
      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
        {issue.priority}
      </span>
    </div>
  )
}
