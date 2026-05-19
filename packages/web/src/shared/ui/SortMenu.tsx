import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import type { SortField, SortRule } from '@/shared/ui/filterState'

const FIELD_LABEL: Record<SortField, string> = {
  priority: 'Priority',
  dueDate: 'Due date',
  startDate: 'Start date',
  createdAt: 'Created',
  updatedAt: 'Updated',
  title: 'Title',
  number: 'Issue number',
  status: 'Status',
}

interface SortMenuProps {
  sortStack: SortRule[]
  onChange: (next: SortRule[]) => void
  /** Restrict the offered fields per view. Defaults to all sortable fields. */
  availableFields?: SortField[]
}

const ALL_FIELDS: SortField[] = [
  'priority',
  'dueDate',
  'startDate',
  'createdAt',
  'updatedAt',
  'title',
  'number',
  'status',
]

/**
 * Single-field sort menu (Phase 1). Writes a 1-entry stack so the
 * shape matches Phase 2's multi-field editor without a data
 * migration. Trigger shows the active field + direction arrow; the
 * popover lists fields with a direction toggle for the current one.
 */
export default function SortMenu({ sortStack, onChange, availableFields = ALL_FIELDS }: SortMenuProps) {
  const [open, setOpen] = useState(false)
  const active = sortStack[0]
  const activeLabel = active ? FIELD_LABEL[active.field] : null
  const ArrowIcon = active?.dir === 'asc' ? ArrowUp : ArrowDown

  const select = (field: SortField) => {
    // Re-clicking the active field flips direction; new field starts desc
    // (most useful for priority/dates — surface the hot ones first).
    if (active?.field === field) {
      onChange([{ field, dir: active.dir === 'asc' ? 'desc' : 'asc' }])
    } else {
      onChange([{ field, dir: 'desc' }])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
            active
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700',
          )}
          title={active ? `Sorted by ${activeLabel} ${active.dir === 'asc' ? '↑' : '↓'}` : 'Sort'}
        >
          {active ? <ArrowIcon className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
          {active ? `${activeLabel}` : 'Sort'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Sort by
        </div>
        {availableFields.map((field) => {
          const isActive = active?.field === field
          return (
            <button
              key={field}
              type="button"
              onClick={() => select(field)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                {isActive ? <Check className="h-3 w-3 text-primary-600" /> : <span className="w-3" />}
                {FIELD_LABEL[field]}
              </span>
              {isActive && (
                <span className="text-gray-500 dark:text-gray-400">
                  {active.dir === 'asc' ? '↑ Asc' : '↓ Desc'}
                </span>
              )}
            </button>
          )
        })}
        {active && (
          <>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            <button
              type="button"
              onClick={() => {
                onChange([])
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X className="h-3 w-3" />
              Reset to manual order
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
