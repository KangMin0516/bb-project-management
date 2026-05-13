import { cn } from '@/shared/lib/utils'
import { GROUP_BY_OPTIONS, type GroupBy } from '@/features/timeline/lib'

const LABELS: Record<GroupBy, string> = {
  epic: 'By Epic',
  type: 'By Type',
  assignee: 'By Assignee',
}

export default function GroupByToggle({ value, onChange }: { value: GroupBy; onChange: (next: GroupBy) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 p-0.5">
      {GROUP_BY_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === opt
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          {LABELS[opt]}
        </button>
      ))}
    </div>
  )
}
