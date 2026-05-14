import { useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { dashboardApi } from '@/features/dashboard/api'
import { useAuthStore } from '@/features/auth/store'
import MemberStatsRow from '@/features/dashboard/components/member/MemberStatsRow'
import MemberStandupSection from '@/features/dashboard/components/member/MemberStandupSection'
import MemberActivitySection from '@/features/dashboard/components/member/MemberActivitySection'
import MemberIssueGroups from '@/features/dashboard/components/member/MemberIssueGroups'
import type { MemberDetailResponse } from '@/features/dashboard/api'

/**
 * Admin drill-down for a single team member. Stats + standup + activity
 * + project-grouped issues are each their own component; this page only
 * fetches and groups data.
 */
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
  const groupedByProject = useMemo(() => {
    if (!issues) return []
    type Issue = MemberDetailResponse['issues'][number]
    const map = new Map<string, { project: Issue['project']; issues: Issue[] }>()
    for (const issue of issues) {
      const proj = issue.project
      if (!map.has(proj.id)) map.set(proj.id, { project: proj, issues: [] })
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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition"
          aria-label="Back to team dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-sm font-medium text-primary-700 dark:text-primary-300 overflow-hidden">
            {data.user.avatar
              ? <img src={data.user.avatar} alt={data.user.name} className="h-full w-full object-cover" />
              : data.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{data.user.name}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{(data.issues ?? []).length} active issues</p>
          </div>
        </div>
      </div>

      <MemberStatsRow todayStats={data.todayStats} />
      <MemberStandupSection standup={data.standup} />
      <MemberIssueGroups groups={groupedByProject} />
      <MemberActivitySection activityLog={data.activityLog} />
    </div>
  )
}
