import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge } from '@/lib/time'

type SortMode = 'dueDate' | 'priority'

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [sortMode, setSortMode] = useState<SortMode>('dueDate')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => dashboardApi.getStats(projectId!),
    enabled: !!projectId,
  })

  const sortedMyIssues = useMemo(() => {
    if (!stats?.myIssues) return []
    const issues = [...stats.myIssues]
    if (sortMode === 'priority') {
      const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      issues.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
    }
    // dueDate sort is default from API
    return issues
  }, [stats?.myIssues, sortMode])

  const overdueCount = useMemo(() => {
    if (!stats?.myIssues) return 0
    const now = new Date()
    return stats.myIssues.filter((i) => i.dueDate && new Date(i.dueDate) < now).length
  }, [stats?.myIssues])

  if (isLoading || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900">{stats.project.name} Dashboard</h1>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">Total Issues</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{stats.totalIssues}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">Members</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{stats.memberCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">Completion</div>
          <div className="mt-1 text-3xl font-bold text-gray-900">
            {stats.totalIssues
              ? Math.round(
                  ((stats.byStatus.find((s) => s.status === 'DONE')?.count || 0) / stats.totalIssues) * 100,
                )
              : 0}
            %
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">My Issues</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{stats.myIssues.length}</span>
            {overdueCount > 0 && (
              <span className="text-sm font-medium text-red-600">{overdueCount} overdue</span>
            )}
          </div>
        </div>
      </div>

      {/* My Issues — enhanced */}
      {stats.myIssues.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              My Issues ({stats.myIssues.length})
            </h2>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
              {([['dueDate', 'Due Date'], ['priority', 'Priority']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortMode(key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition',
                    sortMode === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {sortedMyIssues.map((issue) => {
              const badge = getDueBadge(issue.dueDate)
              const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date()
              return (
                <div
                  key={issue.id}
                  onClick={() => navigate(`/projects/${projectId}/board`)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50',
                    isOverdue && 'bg-red-50/50',
                  )}
                >
                  <span className="text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
                  <span className="font-mono text-xs text-gray-400">{stats.project.key}-{issue.number}</span>
                  <span className={cn('flex-1 truncate text-sm font-medium', isOverdue ? 'text-red-700' : 'text-gray-900')}>
                    {issue.title}
                  </span>
                  {badge && (
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
                      {badge.text}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
                    <span className="text-xs text-gray-500">{issue.status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                    {issue.priority}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* By Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">By Status</h2>
          <div className="space-y-2">
            {stats.byStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[s.status])} />
                <span className="flex-1 text-sm text-gray-600">{s.status.replace(/_/g, ' ')}</span>
                <span className="text-sm font-medium text-gray-900">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Priority */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">By Priority</h2>
          <div className="space-y-2">
            {stats.byPriority.map((p) => (
              <div key={p.priority} className="flex items-center gap-3">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    PRIORITY_COLORS[p.priority] || 'bg-gray-100 text-gray-600',
                  )}
                >
                  {p.priority}
                </span>
                <span className="flex-1" />
                <span className="text-sm font-medium text-gray-900">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Assignee */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">By Assignee</h2>
          <div className="space-y-2">
            {stats.byAssignee.map((a, i) => (
              <div key={a.assignee?.id || i} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700">
                  {a.assignee?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="flex-1 text-sm text-gray-600">{a.assignee?.name || 'Unassigned'}</span>
                <span className="text-sm font-medium text-gray-900">{a.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Recent Activity</h2>
          <div className="space-y-2">
            {stats.recentActivities.length === 0 && (
              <p className="text-sm text-gray-400">No recent activity</p>
            )}
            {stats.recentActivities.slice(0, 8).map((a) => (
              <div key={a.id} className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{a.user?.name}</span>{' '}
                changed <span className="font-medium">{a.field}</span>{' '}
                {a.oldValue && (
                  <>
                    <span className="line-through">{a.oldValue}</span> →{' '}
                  </>
                )}
                <span className="font-medium text-gray-700">{a.newValue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
