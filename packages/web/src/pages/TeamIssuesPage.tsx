import { useMemo, useState } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { dashboardApi, type GlobalIssue } from '@/features/dashboard/api'
import { useAuthStore } from '@/features/auth/store'
import { cn } from '@/shared/lib/utils'
import TeamIssueRow from '@/features/dashboard/components/team/TeamIssueRow'
import IssueDetailPanel from '@/features/issue/components/IssueDetailPanel'

const FILTER_CONFIG: Record<string, { title: string; description: string }> = {
  overdue: { title: 'Overdue Issues', description: 'Due date has passed and not yet completed' },
  unassigned: { title: 'Unassigned Issues', description: 'No assignee assigned yet' },
  completed_today: { title: 'Completed Today', description: 'Issues completed today' },
  in_progress: { title: 'In Progress', description: 'Currently being worked on' },
  todo: { title: 'To Do', description: 'Planned but not started' },
  all: { title: 'All Active Issues', description: 'All issues that are not done or canceled' },
}

/**
 * Admin filtered cross-project issue list. Lives next to TeamDashboardPage
 * — opens issues in the IssueDetailPanel so corrections can happen in
 * place without leaving the admin context.
 */
export default function TeamIssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const filter = searchParams.get('filter') ?? 'all'
  const [selectedIssue, setSelectedIssue] = useState<GlobalIssue | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['team-issues', filter],
    queryFn: () => dashboardApi.getTeamIssues(filter),
    enabled: !!currentUser?.isSuperuser,
  })

  const grouped = useMemo(() => {
    if (!data?.issues) return []
    const map = new Map<string, { project: GlobalIssue['project']; issues: GlobalIssue[] }>()
    for (const issue of data.issues) {
      const proj = issue.project
      if (!map.has(proj.id)) map.set(proj.id, { project: proj, issues: [] })
      map.get(proj.id)!.issues.push(issue)
    }
    return [...map.values()].sort((a, b) => b.issues.length - a.issues.length)
  }, [data?.issues])

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const cfg = FILTER_CONFIG[filter] ?? FILTER_CONFIG.all
  const issueList = data.issues ?? []

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
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{cfg.title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{issueList.length} issues — {cfg.description}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 w-fit">
        {Object.entries(FILTER_CONFIG).map(([key, { title }]) => (
          <button
            key={key}
            onClick={() => setSearchParams({ filter: key })}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              filter === key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            {title.replace(' Issues', '').replace('All Active ', 'All')}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No issues found</p>
      ) : (
        <div className="space-y-4">
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
                {projectIssues.map((issue) => (
                  <TeamIssueRow
                    key={issue.id}
                    issue={issue}
                    projectKey={project.key}
                    isSelected={selectedIssue?.id === issue.id}
                    onClick={() => setSelectedIssue(issue)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedIssue && (
        <IssueDetailPanel
          projectId={selectedIssue.project.id}
          projectKey={selectedIssue.project.key}
          issue={selectedIssue}
          context="issues"
          onClose={() => setSelectedIssue(null)}
          onNavigate={(issue) => {
            const found = issueList.find((i) => i.id === issue.id)
            if (found) setSelectedIssue(found)
          }}
        />
      )}
    </div>
  )
}
