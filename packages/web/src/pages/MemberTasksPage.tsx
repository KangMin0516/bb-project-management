import { useState, useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type MemberDetailResponse } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_ICONS, STANDUP_STATUS_CONFIG, getBestStandupStatus } from '@/lib/constants'
import { getDueBadge } from '@/lib/time'
import { ArrowLeft, MessageSquare, Activity, ChevronDown, ChevronRight } from 'lucide-react'

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const month = d.getMonth() + 1
  const day = d.getDate()
  const dayName = days[d.getDay()]
  return `${month}/${day} (${dayName})`
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  assigneeId: 'Assignee',
  reviewerAssigneeId: 'Reviewer',
  priority: 'Priority',
  title: 'Title',
  description: 'Description',
  type: 'Type',
  dueDate: 'Due date',
  focusDate: 'Focus date',
  parentId: 'Parent',
  order: 'Order',
  created: 'Created',
}

function formatValue(field: string, value: string | null): string | null {
  if (!value) return null
  if (field === 'status') return STATUS_LABELS[value] ?? value
  if (field === 'priority') return PRIORITY_LABELS[value] ?? value
  if (field === 'type') {
    const typeLabels: Record<string, string> = { EPIC: 'Epic', TASK: 'Task', BUG: 'Bug', SUB_TASK: 'Sub-task' }
    return typeLabels[value] ?? value
  }
  return value
}

function formatFieldChange(field: string, oldValue: string | null, newValue: string | null): string {
  const label = FIELD_LABELS[field] ?? field
  if (field === 'created') return 'Issue created'
  const fmtOld = formatValue(field, oldValue)
  const fmtNew = formatValue(field, newValue)
  if (fmtOld && fmtNew) return `${label}: ${fmtOld} → ${fmtNew}`
  if (fmtNew) return `${label} → ${fmtNew}`
  if (fmtOld) return `${label}: ${fmtOld} → (removed)`
  return `${label} changed`
}

export default function MemberTasksPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['member-detail', userId],
    queryFn: () => dashboardApi.getMemberDetail(userId!),
    enabled: !!userId && !!currentUser?.isSuperuser,
  })

  const issues = data?.issues
  // Group issues by project
  const grouped = useMemo(() => {
    if (!issues) return []
    const map = new Map<string, { project: { id: string; name: string; key: string }; issues: typeof issues }>()
    for (const issue of issues) {
      const proj = issue.project
      if (!map.has(proj.id)) {
        map.set(proj.id, { project: proj, issues: [] })
      }
      map.get(proj.id)!.issues.push(issue)
    }
    return [...map.values()].sort((a, b) => b.issues.length - a.issues.length)
  }, [issues])

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const { user, todayStats, standup, activityLog } = data
  const issueList = issues ?? []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-sm font-medium text-primary-700 dark:text-primary-300 overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{user.name}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{issueList.length} active issues</p>
          </div>
        </div>
      </div>

      {/* Today Stats */}
      <div className="mb-6 grid grid-cols-5 gap-3">
        <StatCard label="Focus" value={todayStats.focusCount} icon="🎯" color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard label="Todo" value={todayStats.todoCount} icon="📋" color="text-blue-500 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label="In Progress" value={todayStats.inProgressCount} icon="🔄" color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label="Done Today" value={todayStats.completedCount} icon="✅" color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-900/20" />
        <StatCard label="Overdue" value={todayStats.overdueCount} icon="⚠️" color={todayStats.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'} bg={todayStats.overdueCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'} />
      </div>

      {/* Today's Standup */}
      {standup.length > 0 && <StandupSection standup={standup} />}

      {/* Issues grouped by project */}
      {grouped.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No active issues</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ project, issues: projectIssues }) => (
            <div key={project.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
                <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {project.key}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">({projectIssues.length})</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {projectIssues.map((issue) => {
                  const dueBadge = issue.dueDate ? getDueBadge(issue.dueDate) : null
                  return (
                    <button
                      key={issue.id}
                      onClick={() => navigate(`/projects/${project.id}/board`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
                      <span className="shrink-0 text-xs">{TYPE_ICONS[issue.type] ?? '📌'}</span>
                      <span className="shrink-0 text-xs font-mono text-gray-400 dark:text-gray-500">
                        {project.key}-{issue.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                        {issue.title}
                      </span>
                      {issue.labels?.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1">
                          {issue.labels.slice(0, 2).map((l) => (
                            <span
                              key={l.label.id}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: l.label.color + '20', color: l.label.color }}
                            >
                              {l.label.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="hidden sm:inline rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {STATUS_LABELS[issue.status] ?? issue.status}
                      </span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                        {PRIORITY_LABELS[issue.priority] ?? issue.priority}
                      </span>
                      {dueBadge && (
                        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', dueBadge.className)}>
                          {dueBadge.text}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {activityLog.length > 0 && <ActivitySection activityLog={activityLog} />}
    </div>
  )
}

function StatCard({ label, value, icon, color, bg }: { label: string; value: number; icon: string; color: string; bg: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center', bg)}>
      <div className="text-sm">{icon}</div>
      <div className={cn('text-xl font-bold', color)}>{value}</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function StandupSection({ standup }: { standup: MemberDetailResponse['standup'] }) {
  const [open, setOpen] = useState(true)

  const bestStatus = getBestStandupStatus(standup.map((r) => r.status))
  const statusCfg = STANDUP_STATUS_CONFIG[bestStatus] ?? STANDUP_STATUS_CONFIG.UNANSWERED
  const answeredReports = standup.filter((r) => r.status === 'ANSWERED' && r.answers.length > 0)

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Standup</span>
          <span className={cn('text-[11px] font-medium', statusCfg.color)}>{statusCfg.label}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
          {answeredReports.length === 0 ? (
            <p className="text-sm text-gray-400">No answers yet</p>
          ) : (
            <div className="space-y-4">
              {answeredReports.map((r) => (
                <div key={r.configName}>
                  {standup.length > 1 && (
                    <div className="mb-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">{r.configName}</div>
                  )}
                  <div className="space-y-2">
                    {r.answers.map((a, i) => (
                      <div key={i} className="text-xs">
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
      )}
    </div>
  )
}

function ActivitySection({ activityLog }: { activityLog: MemberDetailResponse['activityLog'] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Activity</span>
          <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            7 days
          </span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {activityLog.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {activityLog.map(({ date, entries }) => (
                <div key={date} className="px-4 py-3">
                  <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {formatDateLabel(date)}
                    <span className="ml-1.5 text-gray-400 dark:text-gray-500 font-normal">({entries.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {entries.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 font-mono text-primary-600 dark:text-primary-400">
                          {entry.projectKey}-{entry.issueNumber}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-gray-700 dark:text-gray-300">
                            {formatFieldChange(entry.field, entry.oldValue, entry.newValue)}
                          </span>
                          <span className="ml-1.5 text-gray-400 dark:text-gray-500 truncate">
                            {entry.issueTitle}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
