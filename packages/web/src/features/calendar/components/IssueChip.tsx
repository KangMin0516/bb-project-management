import type { Issue } from '@/features/issue/api'
import { STATUS_BAR_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'

interface IssueChipProps {
  issue: Issue
  projectKey: string | undefined
  onClick: () => void
}

/**
 * One issue rendered in a DayCell. Dimmed when DONE/CANCELED so the
 * calendar still surfaces historical deadlines without making them
 * shout. Matches the visual weight of the Slack Block Kit chip the
 * standup DMs use (status dot + icon + key + truncated title).
 *
 * Status dot mirrors the Board TOC sidebar — same `STATUS_BAR_COLORS`
 * palette so the user can read the same signal across views.
 */
export default function IssueChip({ issue, projectKey, onClick }: IssueChipProps) {
  const inert = issue.status === 'DONE' || issue.status === 'CANCELED'
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={`${issue.title} · ${issue.status.replace('_', ' ')}`}
      className={cn(
        'group flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs',
        'bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900/30',
        inert && 'opacity-50 line-through',
      )}
    >
      <span
        className={cn(
          'inline-block h-2 w-2 shrink-0 rounded-full',
          STATUS_BAR_COLORS[issue.status] ?? 'bg-gray-300',
        )}
        aria-label={issue.status.replace('_', ' ')}
      />
      <span className="shrink-0">{TYPE_ICONS[issue.type] || ''}</span>
      {projectKey && (
        <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
          {projectKey}-{issue.number}
        </span>
      )}
      <span className="truncate text-gray-900 dark:text-gray-100">{issue.title}</span>
    </button>
  )
}
