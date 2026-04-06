import type { Issue } from '@/api/issues'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, TYPE_ICONS } from '@/lib/constants'

interface Props {
  issue: Issue
  projectKey: string
  onClick: () => void
}

export default function IssueCard({ issue, projectKey, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
        <span className="font-mono text-xs text-gray-400">
          {projectKey}-{issue.number}
        </span>
      </div>
      <p className="mb-2 text-sm font-medium leading-snug text-gray-900">{issue.title}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              PRIORITY_COLORS[issue.priority] || 'bg-gray-100 text-gray-600',
            )}
          >
            {issue.priority}
          </span>
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
        {issue.assignee && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700"
            title={issue.assignee.name}
          >
            {issue.assignee.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
