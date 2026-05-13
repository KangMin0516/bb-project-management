import { cn } from '@/shared/lib/utils'

interface TabSwitcherProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (next: T) => void
  /** Visual variant — 'segmented' is the JIRA/GitHub-style pill toggle. */
  variant?: 'segmented'
}

/** Reusable segmented tab toggle. Generic over the tab id type. */
export default function TabSwitcher<T extends string>({ options, value, onChange }: TabSwitcherProps<T>) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            value === opt.value
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
