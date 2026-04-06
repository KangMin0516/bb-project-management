import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants'

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => dashboardApi.getStats(projectId!),
    enabled: !!projectId,
  })

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
      <div className="mb-6 grid grid-cols-3 gap-4">
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
      </div>

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
            {stats.recentActivities.slice(0, 8).map((a: any) => (
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
