import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
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

/** Max chip count in the stack. ClickUp also caps around here — past
 *  4 fields each extra rule adds almost no real-world disambiguation. */
const MAX_STACK = 4

interface SortMenuProps {
  sortStack: SortRule[]
  onChange: (next: SortRule[]) => void
  /** Restrict the offered fields per view. Defaults to all sortable fields. */
  availableFields?: SortField[]
}

/**
 * Multi-field sort stack editor (ClickUp-style). Each entry is a chip
 * with its own direction toggle, ↑/↓ reorder buttons, and remove ×.
 * "+ Add field" picks an unused field; cap at MAX_STACK. The URL codec
 * and BE Prisma orderBy already accept the comma-separated stack from
 * PM-34 Phase 1, so this is a pure UI upgrade.
 */
export default function SortMenu({ sortStack, onChange, availableFields = ALL_FIELDS }: SortMenuProps) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)

  const usedFields = new Set(sortStack.map((r) => r.field))
  const unusedFields = availableFields.filter((f) => !usedFields.has(f))
  const canAdd = sortStack.length < MAX_STACK && unusedFields.length > 0

  const updateChip = (idx: number, next: Partial<SortRule>) => {
    onChange(sortStack.map((r, i) => (i === idx ? { ...r, ...next } : r)))
  }
  const removeChip = (idx: number) => {
    onChange(sortStack.filter((_, i) => i !== idx))
  }
  const moveChip = (idx: number, delta: -1 | 1) => {
    const target = idx + delta
    if (target < 0 || target >= sortStack.length) return
    const next = sortStack.slice()
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }
  const addField = (field: SortField) => {
    onChange([...sortStack, { field, dir: 'desc' }])
    setPicking(false)
  }

  const first = sortStack[0]
  const extra = sortStack.length - 1
  const TriggerArrow = first?.dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setPicking(false)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
            sortStack.length
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700',
          )}
          title={
            sortStack.length === 0
              ? 'Sort'
              : sortStack.map((r) => `${FIELD_LABEL[r.field]} ${r.dir === 'asc' ? '↑' : '↓'}`).join(' → ')
          }
        >
          {first ? <TriggerArrow className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
          {first ? FIELD_LABEL[first.field] : 'Sort'}
          {extra > 0 && <span className="opacity-70">+{extra}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="start">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Sort by
        </div>

        {/* Empty state shows the field list inline so a single-field
            sort is one click, matching the Phase 1 ergonomics. The chip
            editor + "Add field" picker appears once the stack is non-
            empty. */}
        {sortStack.length === 0 &&
          unusedFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => addField(field)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {FIELD_LABEL[field]}
            </button>
          ))}

        {sortStack.map((rule, idx) => (
          <SortChip
            key={`${rule.field}-${idx}`}
            rule={rule}
            isFirst={idx === 0}
            isLast={idx === sortStack.length - 1}
            onToggleDir={() => updateChip(idx, { dir: rule.dir === 'asc' ? 'desc' : 'asc' })}
            onMoveUp={() => moveChip(idx, -1)}
            onMoveDown={() => moveChip(idx, 1)}
            onRemove={() => removeChip(idx)}
          />
        ))}

        {sortStack.length > 0 && canAdd && !picking && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-1 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30"
          >
            <Plus className="h-3 w-3" />
            Add sort field
          </button>
        )}

        {picking && (
          <div className="mt-1 rounded border border-gray-200 dark:border-gray-700">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Pick a field
            </div>
            {unusedFields.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => addField(field)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {FIELD_LABEL[field]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {sortStack.length > 0 && (
          <>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            <button
              type="button"
              onClick={() => {
                onChange([])
                setPicking(false)
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

function SortChip({
  rule,
  isFirst,
  isLast,
  onToggleDir,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  rule: SortRule
  isFirst: boolean
  isLast: boolean
  onToggleDir: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const DirIcon = rule.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <div className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">
      <span className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300">
        {FIELD_LABEL[rule.field]}
      </span>
      <button
        type="button"
        onClick={onToggleDir}
        title={`Toggle direction (currently ${rule.dir === 'asc' ? 'ascending' : 'descending'})`}
        className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-600 dark:hover:text-gray-100"
      >
        <DirIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        title="Increase precedence"
        className="rounded p-0.5 text-gray-400 enabled:hover:bg-gray-100 enabled:hover:text-gray-700 disabled:opacity-30 dark:enabled:hover:bg-gray-600"
      >
        <ChevronUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        title="Decrease precedence"
        className="rounded p-0.5 text-gray-400 enabled:hover:bg-gray-100 enabled:hover:text-gray-700 disabled:opacity-30 dark:enabled:hover:bg-gray-600"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-300"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
