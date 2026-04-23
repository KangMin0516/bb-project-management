import { useMemo } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge } from '@/lib/time'
import { ArrowLeft } from 'lucide-react'

const FILTER_CONFIG: Record<string, { title: string; description: string }> = {
  overdue: { title: 'Overdue Issues', description: 'Due date has passed and not yet completed' },
  unassigned: { title: 'Unassigned Issues', description: 'No assignee assigned yet' },
  completed_today: { title: 'Completed Today', description: 'Issues completed today' },
  in_progress: { title: 'In Progress', description: 'Currently being worked on' },
  todo: { title: 'To Do', description: 'Planned but not started' },
  all: { title: 'All Active Issues', description: 'All issues that are not done or canceled' },
}

export default function TeamIssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const filter = searchParams.get('filter') ?? 'all'

  const { data, isLoading } = useQuery({
    queryKey: ['team-issues', filter],
    queryFn: () => dashboardApi.getTeamIssues(filter),
    enabled: !!currentUser?.isSuperuser,
  })

  const issues = data?.issues
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

  const cfg = FILTER_CONFIG[filter] ?? FILTER_CONFIG.all
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
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{cfg.title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {issueList.length} issues — {cfg.description}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 w-fit">
        {Object.entries(FILTER_CONFIG).map(([key, { title }]) => (
          <button
            key={key}
            onClick={() => setSearchParams({ filter: key })}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              filter === key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
            )}
          >
            {title.replace(' Issues', '').replace('All Active ', 'All')}
          </button>
        ))}
      </div>

      {/* Issues grouped by project */}
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
                      {/* Assignee */}
                      {issue.assignee ? (
                        <span className="hidden sm:inline shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                          {issue.assignee.name}
                        </span>
                      ) : (
                        <span className="hidden sm:inline shrink-0 rounded bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                          Unassigned
                        </span>
                      )}
                      {issue.labels?.length > 0 && (
                        <div className="hidden lg:flex items-center gap-1">
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
    </div>
  )
}
