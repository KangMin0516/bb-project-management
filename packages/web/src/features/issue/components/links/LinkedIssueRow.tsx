import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { STATUS_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import PriorityBadge from '@/features/issue/components/badges/PriorityBadge'
import type { LinkedIssueDisplay } from '@/features/issue/hooks/useLinkedIssuesDisplay'

interface LinkedIssueRowProps {
  link: LinkedIssueDisplay
  onRemove: () => void
}

export default function LinkedIssueRow({ link, onRemove }: LinkedIssueRowProps) {
  const navigate = useNavigate()

  // PM-110: open the linked issue's detail panel via the `?open=` deep-link
  // (same path CommandPalette / dependency graph use). Cross-project safe —
  // the chip carries its own projectKey.
  const goToIssue = () => navigate(`/projects/${link.projectKey}/board?open=${link.issueId}`)

  return (
    <div className="flex items-center gap-2 rounded bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-sm group">
      <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[link.status])} />
      <button
        onClick={goToIssue}
        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-primary-600 transition-colors"
      >
        <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
          {link.projectKey}-{link.number}
        </span>
        <span className="truncate text-gray-700 dark:text-gray-300 text-xs">{link.title}</span>
      </button>
      <PriorityBadge priority={link.priority} className="text-[9px] shrink-0" />
      <button
        onClick={onRemove}
        className="inline-flex items-center gap-0.5 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
        title="Remove link"
      >
        <X className="h-3 w-3" />
        Remove
      </button>
    </div>
  )
}
