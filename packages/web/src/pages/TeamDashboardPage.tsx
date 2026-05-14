import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowUpDown, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuthStore } from '@/features/auth/store'
import { useTeamDashboard } from '@/features/dashboard/hooks/useTeamDashboard'
import { getMemberStatus, STATUS_CONFIG } from '@/features/dashboard/lib/teamStatus'
import TeamKpiCards from '@/features/dashboard/components/team/TeamKpiCards'
import MemberCard from '@/features/dashboard/components/team/MemberCard'
import WorkloadHeatmap from '@/features/dashboard/components/WorkloadHeatmap'

type SortKey = 'status' | 'name' | 'active' | 'overdue'

const SORT_OPTIONS: ReadonlyArray<[SortKey, string]> = [
  ['status', 'Status'],
  ['name', 'Name'],
  ['active', 'Active'],
  ['overdue', 'Overdue'],
]

/**
 * Composition root for the admin team-dashboard. Query + standup grouping
 * live in the feature hook; member rows + KPI cards are isolated
 * components. The page owns search/sort state.
 */
export default function TeamDashboardPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('status')

  const { data, isLoading, standupByUserId } = useTeamDashboard(!!currentUser?.isSuperuser)

  const members = useMemo(() => {
    if (!data) return []
    let list = data.members
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((m) =>
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        m.projects.some((p) => p.key.toLowerCase().includes(q)),
      )
    }
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'status': return STATUS_CONFIG[getMemberStatus(a)].order - STATUS_CONFIG[getMemberStatus(b)].order
        case 'name':   return a.user.name.localeCompare(b.user.name)
        case 'active': return b.overall.totalActive - a.overall.totalActive
        case 'overdue': return b.today.overdueCount - a.today.overdueCount
        default: return 0
      }
    })
  }, [data, search, sortKey])

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">Team Dashboard</h1>

      <TeamKpiCards
        activeMembers={data.summary.activeMembers}
        completedToday={data.summary.completedToday}
        overdueTotal={data.summary.overdueTotal}
        unassignedTotal={data.summary.unassignedTotal}
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
          {SORT_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition',
                sortKey === key
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {key === sortKey && <ArrowUpDown className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {members.map((m) => (
          <MemberCard key={m.user.id} member={m} standupReports={standupByUserId.get(m.user.id)} />
        ))}
        {members.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No members found</p>
        )}
      </div>

      <WorkloadHeatmap heatmap={data.heatmap} />
    </div>
  )
}
