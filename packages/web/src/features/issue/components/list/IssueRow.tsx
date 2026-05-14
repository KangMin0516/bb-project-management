import type { Issue } from '@/features/issue/api'
import { STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { getDueBadge, isIssueOverdue } from '@/shared/lib/time'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '@/entities/user/UserAvatar'
import IssueActionMenu from '@/features/issue/components/IssueActionMenu'
import { confirmDialog } from '@/shared/ui/confirm-dialog'

interface IssueRowProps {
  issue: Issue
  projectKey: string
  isSelected: boolean
  isFocused: boolean
  onOpen: (issue: Issue) => void
  onToggleSelect: (id: string) => void
  onDelete: (issueId: string) => void
}

export default function IssueRow({ issue, projectKey, isSelected, isFocused, onOpen, onToggleSelect, onDelete }: IssueRowProps) {
  const badge = getDueBadge(issue.dueDate)
  const overdue = isIssueOverdue(issue)

  return (
    <tr
      onClick={() => onOpen(issue)}
      className={cn(
        'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700',
        overdue && 'bg-red-50/50',
        isSelected && 'bg-primary-50',
        issue.archivedAt && 'opacity-50',
        isFocused && 'ring-2 ring-inset ring-primary-400 bg-primary-50/50',
      )}
    >
      <td className="w-8 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(issue.id)}
          className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        />
      </td>
      <td className="px-6 py-2 font-mono text-xs text-gray-400 dark:text-gray-500">
        {projectKey}-{issue.number}
      </td>
      <td className={cn('max-w-xs truncate px-3 py-2 font-medium', overdue ? 'text-red-700' : 'text-gray-900 dark:text-gray-100')}>
        <span className="mr-1 text-xs">{TYPE_ICONS[issue.type] || '📋'}</span>
        {issue.title}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[issue.status])} />
          <span className="text-xs text-gray-600 dark:text-gray-400">{issue.status.replace(/_/g, ' ')}</span>
          {issue.isRecheck && (
            <span className="rounded bg-orange-100 px-1 py-0.5 text-[9px] font-medium text-orange-700">Recheck</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[issue.priority])}>
          {issue.priority}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{issue.type.replace(/_/g, ' ')}</td>
      <td className="px-3 py-2">
        {issue.assignee ? (
          <div className="flex items-center gap-1.5">
            <UserAvatar user={issue.assignee} />
            <span className="truncate text-xs text-gray-600 dark:text-gray-400">{issue.assignee.name}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        {badge && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.className)}>
            {badge.text}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
        {new Date(issue.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <IssueActionMenu
          projectKey={projectKey}
          issueNumber={issue.number}
          context="issues"
          onDelete={async () => {
            if (await confirmDialog({
              title: 'Delete this issue?',
              confirmLabel: 'Delete',
              destructive: true,
            })) onDelete(issue.id)
          }}
        />
      </td>
    </tr>
  )
}
