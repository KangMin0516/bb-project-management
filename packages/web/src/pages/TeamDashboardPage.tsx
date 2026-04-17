import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type TeamMember, type TeamStandup } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { Navigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Users, CheckCircle2, AlertTriangle, Inbox, Search, ArrowUpDown, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import WorkloadHeatmap from '@/components/dashboard/WorkloadHeatmap'

type StatusIndicator = 'active' | 'light' | 'idle' | 'overloaded'
type SortKey = 'status' | 'name' | 'active' | 'overdue'

function getMemberStatus(m: TeamMember): StatusIndicator {
  if (m.overall.totalActive > 15) return 'overloaded'
  if (m.recentActivityCount === 0) return 'idle'
  if (m.overall.totalActive <= 2 || m.today.inProgressCount === 0) return 'light'
  return 'active'
}

const STATUS_CONFIG: Record<StatusIndicator, { dot: string; label: string; order: number; tooltip: string }> = {
  overloaded: { dot: 'bg-orange-500', label: 'Overloaded', order: 0, tooltip: '활성 이슈 15개 초과 — 업무 과부하 상태' },
  active: { dot: 'bg-green-500', label: 'Active', order: 1, tooltip: '진행 중 이슈가 있고 24시간 내 활동 있음' },
  light: { dot: 'bg-yellow-500', label: 'Light', order: 2, tooltip: '활성 이슈 2개 이하이거나 진행 중 이슈 없음' },
  idle: { dot: 'bg-red-500', label: 'Idle', order: 3, tooltip: '24시간 내 활동 없음' },
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group/tip relative inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 opacity-0 transition-opacity group-hover/tip:opacity-100">
        <div className="whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg dark:shadow-gray-900/50">
          {text}
        </div>
        <div className="mx-auto h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-gray-900" />
      </div>
    </div>
  )
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

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

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
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">Team Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />} label="Active Members" tooltip="현재 활성(ACTIVE) 상태인 전체 팀원 수" value={summary.activeMembers} bg="bg-blue-50 dark:bg-blue-900/30" />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />} label="Completed Today" tooltip="오늘 DONE으로 변경된 이슈 총 수" value={summary.completedToday} bg="bg-green-50 dark:bg-green-900/30" />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />} label="Overdue" tooltip="기한이 지난 미완료 이슈 총 수" value={summary.overdueTotal} bg="bg-red-50 dark:bg-red-900/30" />
        <KpiCard icon={<Inbox className="h-5 w-5 text-gray-600 dark:text-gray-400" />} label="Unassigned" tooltip="담당자가 없는 미완료 이슈 총 수" value={summary.unassignedTotal} bg="bg-gray-100 dark:bg-gray-700" />
      </div>

      {/* Standup Section */}
      {data.standup.total > 0 && <StandupSection standup={data.standup} />}

      {/* Search + Sort */}
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
          {([['status', 'Status'], ['name', 'Name'], ['active', 'Active'], ['overdue', 'Overdue']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition',
                sortKey === key ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
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
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No members found</p>
        )}
      </div>

      {/* Heatmap */}
      <WorkloadHeatmap heatmap={data.heatmap} />
    </div>
  )
}

function KpiCard({ icon, label, tooltip, value, bg }: { icon: React.ReactNode; label: string; tooltip: string; value: number; bg: string }) {
  return (
    <Tip text={tooltip}>
      <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 p-4 w-full', bg)}>
        <div className="mb-2">{icon}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </Tip>
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
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 hover:border-gray-300 dark:border-gray-600 transition">
      {/* Avatar + Status */}
      <Tip text={config.tooltip}>
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-sm font-medium text-primary-700 dark:text-primary-300 overflow-hidden">
            {member.user.avatar ? (
              <img src={member.user.avatar} alt={member.user.name} className="h-full w-full object-cover" />
            ) : (
              member.user.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800', config.dot)} />
        </div>
      </Tip>

      {/* Name + Projects */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{member.user.name}</span>
          <Tip text={config.tooltip}>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', {
              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400': status === 'active',
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400': status === 'light',
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400': status === 'idle',
              'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400': status === 'overloaded',
            })}>
              {config.label}
            </span>
          </Tip>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {member.projects.length > 0 ? (
            member.projects.map((p) => (
              <span key={p.id} className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                {p.key} <span className="text-gray-400 dark:text-gray-500">{p.role}</span>
              </span>
            ))
          ) : (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">no projects</span>
          )}
        </div>
      </div>

      {/* Today Stats */}
      <div className="flex items-center gap-3 text-xs">
        <Stat label="Focus" tooltip="오늘 포커스로 설정된 이슈 수" value={today.focusCount} color="text-amber-600 dark:text-amber-400" icon="🎯" />
        <Stat label="Todo" tooltip="할 일(TODO) 상태인 이슈 수" value={today.todoCount} color="text-blue-400 dark:text-blue-300" icon="📋" />
        <Stat label="Progress" tooltip="현재 진행 중(IN_PROGRESS)인 이슈 수" value={today.inProgressCount} color="text-blue-600 dark:text-blue-400" icon="🔄" />
        <Stat label="Done" tooltip="오늘 완료(DONE)한 이슈 수" value={today.completedCount} color="text-green-600 dark:text-green-400" icon="✅" />
        <Stat label="Overdue" tooltip="기한이 지난 미완료 이슈 수" value={today.overdueCount} color={today.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'} icon="⚠️" />
      </div>

      {/* Completion bar */}
      <Tip text={`활성 이슈 ${overall.totalActive}개 / 전체 ${overall.totalHistorical}개 중 ${overall.doneHistorical}개 완료 (${completionRate}%)`}>
        <div className="w-24 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
            <span>{overall.totalActive} active</span>
            <span>{completionRate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </Tip>
    </div>
  )
}

function Stat({ label, tooltip, value, color, icon }: { label: string; tooltip: string; value: number; color: string; icon?: string }) {
  return (
    <Tip text={tooltip}>
      <div className="flex flex-col items-center min-w-[48px]">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{icon ?? label.charAt(0)}</span>
        <span className={cn('text-sm font-semibold', color)}>{value}</span>
        <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">{label}</span>
      </div>
    </Tip>
  )
}

const STANDUP_STATUS_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  ANSWERED: { label: 'Answered', color: 'text-green-600', order: 0 },
  ACTIVE: { label: 'In Progress', color: 'text-yellow-600', order: 1 },
  UNANSWERED: { label: 'No Response', color: 'text-red-500', order: 2 },
  AWAY: { label: 'Away', color: 'text-gray-400', order: 3 },
  CANCELED: { label: 'Canceled', color: 'text-gray-400', order: 4 },
}

function StandupSection({ standup }: { standup: TeamStandup }) {
  const [open, setOpen] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  // Group reports by slackUsername
  const grouped = useMemo(() => {
    const map = new Map<string, typeof standup.reports>()
    for (const r of standup.reports) {
      const key = r.slackUsername
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    // Sort users: best status first (ANSWERED < ACTIVE < UNANSWERED < AWAY < CANCELED)
    return [...map.entries()].sort((a, b) => {
      const bestA = Math.min(...a[1].map((r) => STANDUP_STATUS_CONFIG[r.status]?.order ?? 9))
      const bestB = Math.min(...b[1].map((r) => STANDUP_STATUS_CONFIG[r.status]?.order ?? 9))
      return bestA - bestB
    })
  }, [standup])

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Standup</span>
          <span className="rounded-full bg-primary-100 dark:bg-primary-900 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:text-primary-300">
            {standup.answered}/{standup.total}
          </span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {grouped.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No standup reports today</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {grouped.map(([username, reports]) => {
                const isExpanded = expandedUser === username
                const bestStatus = reports.reduce((best, r) => {
                  const order = STANDUP_STATUS_CONFIG[r.status]?.order ?? 9
                  return order < (STANDUP_STATUS_CONFIG[best]?.order ?? 9) ? r.status : best
                }, reports[0].status)
                const bestCfg = STANDUP_STATUS_CONFIG[bestStatus] ?? STANDUP_STATUS_CONFIG.UNANSWERED
                const hasAnyAnswers = reports.some((r) => r.status === 'ANSWERED' && r.answers.length > 0)
                const sysUser = reports[0].systemUser
                const displayName = sysUser?.name ?? username

                return (
                  <div key={username} className="px-4 py-2.5">
                    <button
                      onClick={() => hasAnyAnswers && setExpandedUser(isExpanded ? null : username)}
                      className={cn('flex w-full items-center gap-3 text-left', hasAnyAnswers && 'cursor-pointer')}
                    >
                      {hasAnyAnswers && (
                        isExpanded
                          ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                          : <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                      )}
                      {!hasAnyAnswers && <span className="w-3 shrink-0" />}
                      {sysUser?.avatar ? (
                        <img src={sysUser.avatar} alt={displayName} className="h-5 w-5 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-[10px] font-medium text-primary-700 dark:text-primary-300">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</span>
                      <span className={cn('text-[11px] font-medium', bestCfg.color)}>{bestCfg.label}</span>
                      <div className="flex items-center gap-1">
                        {reports.map((r) => (
                          <span key={r.configName} className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                            {r.configName}
                          </span>
                        ))}
                      </div>
                      {reports.some((r) => r.status === 'ANSWERED' && r.completedAt) && (
                        <span className="ml-auto text-[10px] text-gray-400">
                          {new Date(reports.find((r) => r.status === 'ANSWERED' && r.completedAt)!.completedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </button>

                    {isExpanded && hasAnyAnswers && (
                      <div className="ml-6 mt-2 space-y-3">
                        {reports.filter((r) => r.status === 'ANSWERED' && r.answers.length > 0).map((r) => (
                          <div key={r.configName}>
                            {reports.length > 1 && (
                              <div className="mb-1 text-[10px] font-medium text-gray-400 dark:text-gray-500">{r.configName}</div>
                            )}
                            <div className="space-y-2">
                              {r.answers.map((a, aIdx) => (
                                <div key={aIdx} className="text-xs">
                                  <div className="font-medium text-gray-500 dark:text-gray-400">{a.question}</div>
                                  <div className="mt-0.5 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{a.answer}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
