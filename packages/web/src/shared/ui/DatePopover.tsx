import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { cn } from '@/shared/lib/utils'

interface DatePopoverProps {
  /** ISO-ish string or null. Component reads year/month/day in local time. */
  value: string | null
  /** Fires once, when the user picks a day or clicks Clear. Caller commits. */
  onChange: (next: string | null) => void
  /** Trigger element (read-mode display). The popover anchors to this. */
  children: React.ReactNode
  /** Optional render-prop callback fired when the popover closes. Used by
   *  InlineField to collapse the row after a single commit. */
  onAfterCommit?: () => void
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const endOffset = 6 - ((last.getDay() + 6) % 7)
  const start = new Date(first)
  start.setDate(first.getDate() - startOffset)
  const total = startOffset + last.getDate() + endOffset
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

/**
 * Click-to-open calendar picker. Replaces the native `<input type="date">`
 * which (a) is uglier than a real calendar grid and (b) fires `onChange`
 * on each segment change — causing a PATCH per keystroke and one
 * activity row per micro-update. This popover only commits once: when the
 * user clicks a day or Clear.
 */
export default function DatePopover({ value, onChange, children, onAfterCommit }: DatePopoverProps) {
  const today = new Date()
  const parsed = value ? new Date(value) : null
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => {
    const ref = parsed ?? today
    return new Date(ref.getFullYear(), ref.getMonth(), 1)
  })

  const commit = (next: string | null) => {
    onChange(next)
    setOpen(false)
    onAfterCommit?.()
  }

  const handleSelect = (d: Date) => {
    // Send YYYY-MM-DD at UTC midnight so the persisted timestamp aligns with
    // how Calendar view (and dueDate readouts) bucket by local-day key.
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    commit(`${y}-${m}-${day}T00:00:00.000Z`)
  }

  const days = getMonthGrid(cursor.getFullYear(), cursor.getMonth())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
            aria-label="Previous month"
            className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
            aria-label="Next month"
            className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-1 text-center text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500"
            >
              {w}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth()
            const isSelected = parsed && sameDay(d, parsed)
            const isToday = sameDay(d, today)
            return (
              <button
                key={d.toISOString()}
                onClick={() => handleSelect(d)}
                className={cn(
                  'h-7 w-7 rounded-full text-xs transition',
                  !inMonth && 'text-gray-300 dark:text-gray-600',
                  inMonth && !isSelected && 'text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30',
                  isSelected && 'bg-primary-600 text-white hover:bg-primary-700',
                  !isSelected && isToday && 'ring-1 ring-primary-400 dark:ring-primary-500',
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
          <button
            onClick={() => {
              const now = new Date()
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
              handleSelect(now)
            }}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Today
          </button>
          {value && (
            <button
              onClick={() => commit(null)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
