import type { DashboardStats } from '@/features/dashboard/api'

interface SummaryCardsProps {
  stats: DashboardStats
  overdueCount: number
}

export default function SummaryCards({ stats, overdueCount }: SummaryCardsProps) {
  const completion = stats.totalIssues
    ? Math.round(((stats.byStatus.find((s) => s.status === 'DONE')?.count || 0) / stats.totalIssues) * 100)
    : 0
  const myCount = stats.myIssues.length + stats.myFocusIssues.length

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total Issues" value={stats.totalIssues} />
      <Card label="Members" value={stats.memberCount} />
      <Card label="Completion" value={`${completion}%`} />
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="text-sm text-gray-500 dark:text-gray-400">My Issues</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{myCount}</span>
          {overdueCount > 0 && (
            <span className="text-sm font-medium text-red-600">{overdueCount} overdue</span>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}
