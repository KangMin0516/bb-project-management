import { PRIORITY_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'

interface PriorityBadgeProps {
  priority: string
  className?: string
}

export default function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', PRIORITY_COLORS[priority] || '', className)}>
      {priority}
    </span>
  )
}
