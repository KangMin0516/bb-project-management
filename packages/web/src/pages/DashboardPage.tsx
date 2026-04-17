import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { issueApi, type Issue } from '@/api/issues'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS, PRIORITY_ORDER, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge, isOverdue, todayDateString, isFocusToday } from '@/lib/time'
import { Star, Zap, Clock, CheckCircle2, TrendingDown, Users, GitBranch } from 'lucide-react'
import BurndownChart from '@/components/dashboard/BurndownChart'
import WorkloadChart from '@/components/dashboard/WorkloadChart'
import OverdueAlert from '@/components/dashboard/OverdueAlert'
import DependencyGraph from '@/components/dashboard/DependencyGraph'
import InfoTooltip from '@/components/ui/InfoTooltip'

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sortMode, setSortMode] = useState<'dueDate' | 'priority'>('dueDate')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => dashboardApi.getStats(projectId!),
    enabled: !!projectId,
  })

  const toggleFocusMutation = useMutation({
    mutationFn: ({ issueId, focusDate }: { issueId: string; focusDate: string | null }) =>
      issueApi.update(projectId!, issueId, { focusDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] })
    },
    onError: (err) => {
      console.error('Failed to toggle focus:', err)
    },
  })

  const emptyIssues: Issue[] = useMemo(() => [], [])
  const myIssues = stats?.myIssues ?? emptyIssues
  const myFocusIssues = stats?.myFocusIssues ?? emptyIssues

  const sortedOtherIssues = useMemo(() => {
    if (myIssues.length === 0) return []
    const issues = [...myIssues]
    if (sortMode === 'priority') {
      issues.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    }
    return issues
  }, [myIssues, sortMode])

  const allMyIssues = useMemo(() => [...myFocusIssues, ...myIssues], [myFocusIssues, myIssues])
  const overdueCount = useMemo(
    () => allMyIssues.filter((i) => isOverdue(i.dueDate)).length,
    [allMyIssues],
  )

  // Split focus issues into working now vs planned
  const workingNow = useMemo(
    () => myFocusIssues.filter((i) => i.status === 'IN_PROGRESS'),
    [myFocusIssues],
  )
  const plannedToday = useMemo(
    () => myFocusIssues.filter((i) => i.status !== 'IN_PROGRESS'),
    [myFocusIssues],
  )

  const handleToggleFocus = (issue: Issue) => {
    const isCurrentlyFocused = isFocusToday(issue.focusDate)
    toggleFocusMutation.mutate({
      issueId: issue.id,
      focusDate: isCurrentlyFocused ? null : todayDateString(),
    })
  }

  if (isLoading || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">{stats.project.name} Dashboard</h1>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Issues</div>
          <div className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalIssues}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="text-sm text-gray-500 dark:text-gray-400">Members</div>
          <div className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.memberCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="text-sm text-gray-500 dark:text-gray-400">Completion</div>
          <div className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalIssues
              ? Math.round(
                  ((stats.byStatus.find((s) => s.status === 'DONE')?.count || 0) / stats.totalIssues) * 100,
                )
              : 0}
            %
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="text-sm text-gray-500 dark:text-gray-400">My Issues</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {stats.myIssues.length + stats.myFocusIssues.length}
            </span>
            {overdueCount > 0 && (
              <span className="text-sm font-medium text-red-600">{overdueCount} overdue</span>
            )}
          </div>
        </div>
      </div>

      {/* Today's Focus */}
      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Focus</h2>
          <InfoTooltip lines={[
              { lang: 'EN', text: "Issues you plan to focus on today. Click the star (★) to add. 'Working Now' = in progress, 'Planned Today' = queued." },
              { lang: 'KR', text: '오늘 집중할 이슈 모음입니다. 별(★)을 클릭하여 추가합니다. Working Now=진행 중, Planned Today=오늘 예정.' },
              { lang: 'VN', text: "Các issue tập trung hôm nay. Nhấn ngôi sao (★) để thêm. 'Working Now' = đang làm, 'Planned Today' = dự kiến hôm nay." },
            ]} />
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            {stats.myFocusIssues.length}
          </span>
        </div>

        {stats.myFocusIssues.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            Click the star on any issue below to add it to today's focus
          </p>
        ) : (
          <div className="space-y-3">
            {/* Working Now */}
            {workingNow.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-blue-700">Working Now</span>
                </div>
                <div className="space-y-1">
                  {workingNow.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      projectKey={stats.project.key}
                      focused={true}
                      onToggleFocus={handleToggleFocus}
                      onClick={() => navigate(`/projects/${projectId}/board?open=${issue.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Planned Today */}
            {plannedToday.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Planned Today</span>
                </div>
                <div className="space-y-1">
                  {plannedToday.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      projectKey={stats.project.key}
                      focused={true}
                      onToggleFocus={handleToggleFocus}
                      onClick={() => navigate(`/projects/${projectId}/board?open=${issue.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Other Assigned Issues */}
      {sortedOtherIssues.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Other Assigned ({sortedOtherIssues.length})
            </h2>
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
              {([['dueDate', 'Due Date'], ['priority', 'Priority']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortMode(key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition',
                    sortMode === key
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {sortedOtherIssues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                projectKey={stats.project.key}
                focused={false}
                onToggleFocus={handleToggleFocus}
                onClick={() => navigate(`/projects/${projectId}/board?open=${issue.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Overdue Alert */}
      {stats.overdueIssues && stats.overdueIssues.length > 0 && (
        <div className="mb-6">
          <OverdueAlert
            issues={stats.overdueIssues}
            projectKey={stats.project.key}
            projectId={projectId!}
            onIssueClick={(id) => navigate(`/projects/${projectId}/board?open=${id}`)}
          />
        </div>
      )}

      {/* Dependency Graph */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dependency Graph</h2>
          <InfoTooltip lines={[
              { lang: 'EN', text: 'Visualizes BLOCKS relationships between issues. Active blockers prevent other issues from progressing.' },
              { lang: 'KR', text: '이슈 간 BLOCKS 관계를 시각화합니다. 활성 차단은 다른 이슈 진행을 막고 있는 항목입니다.' },
              { lang: 'VN', text: 'Trực quan hóa quan hệ BLOCKS giữa các issue. Blocker đang hoạt động ngăn các issue khác tiến triển.' },
            ]} />
        </div>
        <DependencyGraph />
      </div>

      {/* Advanced Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Burndown Chart */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Open Issues (Last 30 Days)</h2>
            <InfoTooltip lines={[
              { lang: 'EN', text: 'Shows open issue count over the last 30 days. Declining = issues being resolved. Rising = new issues outpace closures.' },
              { lang: 'KR', text: '지난 30일간 미완료 이슈 수 추이입니다. 하강=이슈 해결 중, 상승=새 이슈가 해결보다 빠르게 생성 중.' },
              { lang: 'VN', text: 'Hiển thị số issue mở trong 30 ngày qua. Giảm = issue đang được giải quyết. Tăng = issue mới nhiều hơn đóng.' },
            ]} />
          </div>
          <BurndownChart data={stats.burndownData ?? []} />
        </div>

        {/* Workload Distribution */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Workload Distribution</h2>
            <InfoTooltip lines={[
              { lang: 'EN', text: 'Shows issue count per assignee, broken down by status. Helps identify workload imbalance.' },
              { lang: 'KR', text: '담당자별 이슈 수를 상태별로 보여줍니다. 업무 편중 여부를 확인할 수 있습니다.' },
              { lang: 'VN', text: 'Hiển thị số issue theo người phụ trách, phân theo trạng thái. Giúp phát hiện mất cân bằng công việc.' },
            ]} />
          </div>
          <WorkloadChart data={stats.workloadByAssignee ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Completion by Assignee */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Completion by Member</h2>
            <InfoTooltip lines={[
              { lang: 'EN', text: 'Shows the ratio of completed (Done) issues to total issues per member.' },
              { lang: 'KR', text: '멤버별 전체 이슈 대비 완료(Done) 이슈 비율을 보여줍니다.' },
              { lang: 'VN', text: 'Hiển thị tỷ lệ issue hoàn thành (Done) trên tổng số issue theo từng thành viên.' },
            ]} />
          </div>
          <div className="space-y-2.5">
            {stats.completionByAssignee.map((stat) => {
              const rate = stat.total ? Math.round((stat.done / stat.total) * 100) : 0
              return (
                <div key={stat.user.id} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700">
                    {stat.user.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="w-20 truncate text-sm text-gray-600 dark:text-gray-500">{stat.user.name}</span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-2 rounded-full bg-green-500 transition-all"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {stat.done}/{stat.total}
                  </span>
                  <span className="w-10 text-right text-xs font-bold text-gray-700 dark:text-gray-300">{rate}%</span>
                </div>
              )
            })}
            {stats.completionByAssignee.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No assigned issues yet</p>
            )}
          </div>
        </div>

        {/* By Status */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">By Status</h2>
          <div className="space-y-2">
            {stats.byStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[s.status])} />
                <span className="flex-1 text-sm text-gray-600 dark:text-gray-500">{s.status.replace(/_/g, ' ')}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Priority */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">By Priority</h2>
          <div className="space-y-2">
            {stats.byPriority.map((p) => (
              <div key={p.priority} className="flex items-center gap-3">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    PRIORITY_COLORS[p.priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-500',
                  )}
                >
                  {p.priority}
                </span>
                <span className="flex-1" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Activity</h2>
          <div className="space-y-2">
            {stats.recentActivities.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity</p>
            )}
            {stats.recentActivities.slice(0, 8).map((a) => (
              <div key={a.id} className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">{a.user?.name}</span>{' '}
                changed <span className="font-medium">{a.field}</span>{' '}
                {a.oldValue && (
                  <>
                    <span className="line-through">{a.oldValue}</span> →{' '}
                  </>
                )}
                <span className="font-medium text-gray-700 dark:text-gray-300">{a.newValue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function IssueRow({
  issue,
  projectKey,
  focused,
  onToggleFocus,
  onClick,
}: {
  issue: Issue
  projectKey: string
  focused: boolean
  onToggleFocus: (issue: Issue) => void
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
        {projectKey}-{issue.number}
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
      <span
        className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}
      >
        {issue.priority}
      </span>
    </div>
  )
}
