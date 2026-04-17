import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type TeamMember } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { Navigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Users, CheckCircle2, AlertTriangle, Inbox, Search, ArrowUpDown } from 'lucide-react'
import WorkloadHeatmap from '@/components/dashboard/WorkloadHeatmap'

type StatusIndicator = 'active' | 'light' | 'idle' | 'overloaded'
type SortKey = 'status' | 'name' | 'active' | 'overdue'

function getMemberStatus(m: TeamMember): StatusIndicator {
  if (m.overall.totalActive > 15) return 'overloaded'
  if (m.recentActivityCount === 0) return 'idle'
  if (m.overall.totalActive <= 2 || m.today.inProgressCount === 0) return 'light'
  return 'active'
}

const STATUS_CONFIG: Record<StatusIndicator, { dot: string; label: string; order: number }> = {
  overloaded: { dot: 'bg-orange-500', label: 'Overloaded', order: 0 },
  active: { dot: 'bg-green-500', label: 'Active', order: 1 },
  light: { dot: 'bg-yellow-500', label: 'Light', order: 2 },
  idle: { dot: 'bg-red-500', label: 'Idle', order: 3 },
}

export default function TeamDashboardPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('status')

  const { data, isLoading } = useQuery({
    queryKey: ['team-dashboard'],
    queryFn: dashboardApi.getTeamDashboard,
    refetchInterval: 60_000,
    enabled: !!currentUser?.isSuperuser,
  })

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

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
        case 'status':
          return STATUS_CONFIG[getMemberStatus(a)].order - STATUS_CONFIG[getMemberStatus(b)].order
        case 'name':
          return a.user.name.localeCompare(b.user.name)
        case 'active':
          return b.overall.totalActive - a.overall.totalActive
        case 'overdue':
          return b.today.overdueCount - a.today.overdueCount
        default:
          return 0
      }
    })
  }, [data, search, sortKey])

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900">Team Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<Users className="h-5 w-5 text-blue-600" />} label="Active Members" value={summary.activeMembers} bg="bg-blue-50" />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Completed Today" value={summary.completedToday} bg="bg-green-50" />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-600" />} label="Overdue" value={summary.overdueTotal} bg="bg-red-50" />
        <KpiCard icon={<Inbox className="h-5 w-5 text-gray-600" />} label="Unassigned" value={summary.unassignedTotal} bg="bg-gray-100" />
      </div>

      {/* Search + Sort */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
          {([['status', 'Status'], ['name', 'Name'], ['active', 'Active'], ['overdue', 'Overdue']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition',
                sortKey === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {key === sortKey && <ArrowUpDown className="h-3 w-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Member Cards */}
      <div className="mb-6 space-y-2">
        {members.map((m) => (
          <MemberCard key={m.user.id} member={m} />
        ))}
        {members.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No members found</p>
        )}
      </div>

      {/* Heatmap */}
      <WorkloadHeatmap heatmap={data.heatmap} />
    </div>
  )
}

function KpiCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 p-4', bg)}>
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function MemberCard({ member }: { member: TeamMember }) {
  const status = getMemberStatus(member)
  const config = STATUS_CONFIG[status]
  const { today, overall } = member

  const completionRate = overall.totalHistorical > 0
    ? Math.round((overall.doneHistorical / overall.totalHistorical) * 100)
    : 0

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 transition">
      {/* Avatar + Status */}
      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700 overflow-hidden">
          {member.user.avatar ? (
            <img src={member.user.avatar} alt={member.user.name} className="h-full w-full object-cover" />
          ) : (
            member.user.name.charAt(0).toUpperCase()
          )}
        </div>
        <span
          className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white', config.dot)}
          title={config.label}
        />
      </div>

      {/* Name + Projects */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{member.user.name}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', {
            'bg-green-100 text-green-700': status === 'active',
            'bg-yellow-100 text-yellow-700': status === 'light',
            'bg-red-100 text-red-700': status === 'idle',
            'bg-orange-100 text-orange-700': status === 'overloaded',
          })}>
            {config.label}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {member.projects.length > 0 ? (
            member.projects.map((p) => (
              <span key={p.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {p.key} <span className="text-gray-400">{p.role}</span>
              </span>
            ))
          ) : (
            <span className="text-[10px] text-gray-400 italic">no projects</span>
          )}
        </div>
      </div>

      {/* Today Stats */}
      <div className="flex items-center gap-3 text-xs">
        <Stat label="Focus" value={today.focusCount} color="text-amber-600" />
        <Stat label="In Progress" value={today.inProgressCount} color="text-blue-600" icon="🔄" />
        <Stat label="Done" value={today.completedCount} color="text-green-600" icon="✅" />
        <Stat label="Overdue" value={today.overdueCount} color={today.overdueCount > 0 ? 'text-red-600' : 'text-gray-400'} icon="⚠️" />
      </div>

      {/* Completion bar */}
      <div className="w-24 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>{overall.totalActive} active</span>
          <span>{completionRate}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full bg-green-500 transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center min-w-[48px]" title={label}>
      <span className="text-[10px] text-gray-400">{icon ?? label.charAt(0)}</span>
      <span className={cn('text-sm font-semibold', color)}>{value}</span>
    </div>
  )
}
