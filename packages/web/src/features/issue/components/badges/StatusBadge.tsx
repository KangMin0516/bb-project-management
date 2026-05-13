import { STATUS_LABELS, STATUS_BADGE_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'

interface StatusBadgeProps {
  status: string
  /** Use the lighter `STATUS_BADGE_COLORS` variant. Default true. */
  withBg?: boolean
  className?: string
}

export default function StatusBadge({ status, withBg = true, className }: StatusBadgeProps) {
  const colorClass = withBg ? STATUS_BADGE_COLORS[status] || 'bg-gray-200 text-gray-700' : ''
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', colorClass, className)}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
