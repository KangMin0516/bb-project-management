import type { ReactNode } from 'react'

export interface ViewOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface ViewToggleProps<T extends string> {
  options: ViewOption<T>[]
  value: T
  onChange: (value: T) => void
}

export default function ViewToggle<T extends string>({
  options,
  value,
  onChange,
}: ViewToggleProps<T>) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 p-0.5">
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              isActive
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {opt.icon && <span className="h-3.5 w-3.5">{opt.icon}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
