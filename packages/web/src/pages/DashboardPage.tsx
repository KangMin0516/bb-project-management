import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TrendingDown, Users, GitBranch } from 'lucide-react'
import { isOverdue, todayDateString, isFocusToday } from '@/shared/lib/time'
import { useProjectDashboard } from '@/features/dashboard/hooks/useProjectDashboard'
import SummaryCards from '@/features/dashboard/components/SummaryCards'
import FocusSection from '@/features/dashboard/components/FocusSection'
import OtherAssignedSection from '@/features/dashboard/components/OtherAssignedSection'
import DistributionPanels from '@/features/dashboard/components/DistributionPanels'
import BurndownChart from '@/features/dashboard/components/BurndownChart'
import WorkloadChart from '@/features/dashboard/components/WorkloadChart'
import OverdueAlert from '@/features/dashboard/components/OverdueAlert'
import DependencyGraph from '@/features/dashboard/components/DependencyGraph'
import InfoTooltip from '@/shared/ui/atoms/InfoTooltip'
import type { Issue } from '@/features/issue/api'

/**
 * Project dashboard composition root. Stats query + focus toggle live in
 * the feature hook; each section owns its own layout.
 */
export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { stats, isLoading, toggleFocus } = useProjectDashboard(projectId ?? '')

  const allMyIssues = useMemo(
    () => [...(stats?.myFocusIssues ?? []), ...(stats?.myIssues ?? [])],
    [stats?.myFocusIssues, stats?.myIssues],
  )
  const overdueCount = useMemo(
    () => allMyIssues.filter((i) => isOverdue(i.dueDate)).length,
    [allMyIssues],
  )

  const workingNow = useMemo(
    () => (stats?.myFocusIssues ?? []).filter((i) => i.status === 'IN_PROGRESS'),
    [stats?.myFocusIssues],
  )
  const plannedToday = useMemo(
    () => (stats?.myFocusIssues ?? []).filter((i) => i.status !== 'IN_PROGRESS'),
    [stats?.myFocusIssues],
  )

  const openIssue = (issue: Issue) => navigate(`/projects/${projectId}/board?open=${issue.id}`)

  const handleToggleFocus = (issue: Issue) => {
    const currentlyFocused = isFocusToday(issue.focusDate)
    toggleFocus.mutate({
      issueId: issue.id,
      focusDate: currentlyFocused ? null : todayDateString(),
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

      <SummaryCards stats={stats} overdueCount={overdueCount} />

      <FocusSection
        workingNow={workingNow}
        plannedToday={plannedToday}
        projectKey={stats.project.key}
        onIssueClick={openIssue}
        onToggleFocus={handleToggleFocus}
      />

      <OtherAssignedSection
        issues={stats.myIssues ?? []}
        projectKey={stats.project.key}
        onIssueClick={openIssue}
        onToggleFocus={handleToggleFocus}
      />

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

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          icon={<TrendingDown className="h-4 w-4 text-blue-500" />}
          title="Open Issues (Last 30 Days)"
          tooltip={[
            { lang: 'EN', text: 'Shows open issue count over the last 30 days. Declining = issues being resolved. Rising = new issues outpace closures.' },
            { lang: 'KR', text: '지난 30일간 미완료 이슈 수 추이입니다. 하강=이슈 해결 중, 상승=새 이슈가 해결보다 빠르게 생성 중.' },
            { lang: 'VN', text: 'Hiển thị số issue mở trong 30 ngày qua. Giảm = issue đang được giải quyết. Tăng = issue mới nhiều hơn đóng.' },
          ]}
        >
          <BurndownChart data={stats.burndownData ?? []} />
        </ChartCard>

        <ChartCard
          icon={<Users className="h-4 w-4 text-indigo-500" />}
          title="Workload Distribution"
          tooltip={[
            { lang: 'EN', text: 'Shows issue count per assignee, broken down by status. Helps identify workload imbalance.' },
            { lang: 'KR', text: '담당자별 이슈 수를 상태별로 보여줍니다. 업무 편중 여부를 확인할 수 있습니다.' },
            { lang: 'VN', text: 'Hiển thị số issue theo người phụ trách, phân theo trạng thái. Giúp phát hiện mất cân bằng công việc.' },
          ]}
        >
          <WorkloadChart data={stats.workloadByAssignee ?? []} />
        </ChartCard>
      </div>

      <DistributionPanels stats={stats} />
    </div>
  )
}

function ChartCard({
  icon,
  title,
  tooltip,
  children,
}: {
  icon: React.ReactNode
  title: string
  tooltip: Parameters<typeof InfoTooltip>[0]['lines']
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
        <InfoTooltip lines={tooltip} />
      </div>
      {children}
    </div>
  )
}
