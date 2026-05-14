import type { DashboardStats } from '@/features/dashboard/api'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'

interface DistributionPanelsProps {
  stats: DashboardStats
}

/**
 * Bottom grid of the dashboard: Completion-by-Member, By-Status,
 * By-Priority, and Recent-Activity panels. Each panel is tiny so they
 * live as locals here rather than separate files.
 */
export default function DistributionPanels({ stats }: DistributionPanelsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <CompletionPanel stats={stats} />
      <StatusPanel stats={stats} />
      <PriorityPanel stats={stats} />
      <ActivityPanel stats={stats} />
    </div>
  )
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      {children}
    </div>
  )
}

function CompletionPanel({ stats }: { stats: DashboardStats }) {
  return (
    <Card title="Completion by Member">
      <div className="space-y-2.5">
        {stats.completionByAssignee.map((stat) => {
          const rate = stat.total ? Math.round((stat.done / stat.total) * 100) : 0
          return (
            <div key={stat.user.id} className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700">
                {stat.user.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="w-20 truncate text-sm text-gray-600 dark:text-gray-400">{stat.user.name}</span>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${rate}%` }} />
                </div>
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.done}/{stat.total}</span>
              <span className="w-10 text-right text-xs font-bold text-gray-700 dark:text-gray-300">{rate}%</span>
            </div>
          )
        })}
        {stats.completionByAssignee.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No assigned issues yet</p>
        )}
      </div>
    </Card>
  )
}

function StatusPanel({ stats }: { stats: DashboardStats }) {
  return (
    <Card title="By Status">
      <div className="space-y-2">
        {stats.byStatus.map((s) => (
          <div key={s.status} className="flex items-center gap-3">
            <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[s.status])} />
            <span className="flex-1 text-sm text-gray-600 dark:text-gray-400">{s.status.replace(/_/g, ' ')}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.count}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function PriorityPanel({ stats }: { stats: DashboardStats }) {
  return (
    <Card title="By Priority">
      <div className="space-y-2">
        {stats.byPriority.map((p) => (
          <div key={p.priority} className="flex items-center gap-3">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                PRIORITY_COLORS[p.priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
              )}
            >
              {p.priority}
            </span>
            <span className="flex-1" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.count}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ActivityPanel({ stats }: { stats: DashboardStats }) {
  return (
    <Card title="Recent Activity">
      <div className="space-y-2">
        {stats.recentActivities.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity</p>
        )}
        {stats.recentActivities.slice(0, 8).map((a) => (
          <div key={a.id} className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">{a.user?.name}</span>{' '}
            changed <span className="font-medium">{a.field}</span>{' '}
            {a.oldValue && <><span className="line-through">{a.oldValue}</span> → </>}
            <span className="font-medium text-gray-700 dark:text-gray-300">{a.newValue}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
