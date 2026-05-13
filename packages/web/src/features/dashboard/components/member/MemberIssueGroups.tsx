import { useNavigate } from 'react-router-dom'
import type { MemberDetailResponse } from '@/features/dashboard/api'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, TYPE_ICONS } from '@/shared/config/constants'
import { getDueBadge } from '@/shared/lib/time'
import { cn } from '@/shared/lib/utils'

type Issue = MemberDetailResponse['issues'][number]
type ProjectGroup = { project: Issue['project']; issues: Issue[] }

interface MemberIssueGroupsProps {
  groups: ProjectGroup[]
}

export default function MemberIssueGroups({ groups }: MemberIssueGroupsProps) {
  if (groups.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No active issues</p>
  }

  return (
    <div className="space-y-6">
      {groups.map(({ project, issues }) => (
        <div key={project.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
            <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              {project.key}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">({issues.length})</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} projectKey={project.key} projectId={project.id} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function IssueRow({ issue, projectKey, projectId }: { issue: Issue; projectKey: string; projectId: string }) {
  const navigate = useNavigate()
  const dueBadge = issue.dueDate ? getDueBadge(issue.dueDate) : null

  return (
    <button
      onClick={() => navigate(`/projects/${projectId}/board`)}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
      <span className="shrink-0 text-xs">{TYPE_ICONS[issue.type] ?? '📌'}</span>
      <span className="shrink-0 text-xs font-mono text-gray-400 dark:text-gray-500">{projectKey}-{issue.number}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{issue.title}</span>
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
}
