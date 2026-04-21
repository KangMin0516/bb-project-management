import { useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type MemberIssuesResponse } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_ICONS } from '@/lib/constants'
import { getDueBadge } from '@/lib/time'
import { ArrowLeft } from 'lucide-react'

export default function MemberTasksPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['member-issues', userId],
    queryFn: () => dashboardApi.getMemberIssues(userId!),
    enabled: !!userId && !!currentUser?.isSuperuser,
  })

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const { user, issues } = data

  // Group issues by project
  const grouped = useMemo(() => {
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
            <p className="text-xs text-gray-500 dark:text-gray-400">{issues.length} active issues</p>
          </div>
        </div>
      </div>

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
                      {/* Status dot */}
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />

                      {/* Type */}
                      <span className="shrink-0 text-xs">{TYPE_ICONS[issue.type] ?? '📌'}</span>

                      {/* Number */}
                      <span className="shrink-0 text-xs font-mono text-gray-400 dark:text-gray-500">
                        {project.key}-{issue.number}
                      </span>

                      {/* Title */}
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                        {issue.title}
                      </span>

                      {/* Labels */}
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

                      {/* Status */}
                      <span className="hidden sm:inline rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {STATUS_LABELS[issue.status] ?? issue.status}
                      </span>

                      {/* Priority */}
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
                        {PRIORITY_LABELS[issue.priority] ?? issue.priority}
                      </span>

                      {/* Due date */}
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
