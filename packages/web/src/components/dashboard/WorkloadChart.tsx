import type { WorkloadAssignee } from '@/api/dashboard'
import { STATUSES, STATUS_LABELS, STATUS_BAR_COLORS } from '@/lib/constants'

interface Props {
  data: WorkloadAssignee[]
}

export default function WorkloadChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No assignee data available
      </div>
    )
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1)

  return (
    <div className="space-y-3">
      {data.map((assignee) => (
        <div key={assignee.assigneeId} className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700">
            {assignee.name?.charAt(0).toUpperCase() || '?'}
          </div>
          {/* Name */}
          <span className="w-20 shrink-0 truncate text-sm text-gray-600 dark:text-gray-500">
            {assignee.name}
          </span>
          {/* Stacked bar */}
          <div className="flex flex-1 items-center gap-0">
            <div
              className="flex h-5 overflow-hidden rounded"
              style={{ width: `${(assignee.total / maxTotal) * 100}%`, minWidth: '20px' }}
            >
              {STATUSES.map((status) => {
                const count = assignee.statuses[status] || 0
                if (count === 0) return null
                const pct = (count / assignee.total) * 100
                return (
                  <div
                    key={status}
                    className={`${STATUS_BAR_COLORS[status] || 'bg-gray-300'} relative`}
                    style={{ width: `${pct}%`, minWidth: '4px' }}
                    title={`${STATUS_LABELS[status] || status}: ${count}`}
                  />
                )
              })}
            </div>
          </div>
          {/* Total count */}
          <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
            {assignee.total}
          </span>
        </div>
      ))}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-100 dark:border-gray-700 pt-3">
        {STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-sm ${STATUS_BAR_COLORS[status]}`} />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{STATUS_LABELS[status] || status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
