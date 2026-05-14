import { cn } from '@/shared/lib/utils'
import type { GroupedEndpoints } from '@/features/api-docs/types'

interface TagSidebarProps {
  groups: GroupedEndpoints[]
  activeTag: string | null
  onSelect: (tag: string) => void
}

export default function TagSidebar({ groups, activeTag, onSelect }: TagSidebarProps) {
  return (
    <aside className="hidden lg:flex w-56 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Modules</h3>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {groups.map((g) => (
          <button
            key={g.tag}
            onClick={() => {
              onSelect(g.tag)
              document.getElementById(`tag-${g.tag}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm',
              activeTag === g.tag
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
            )}
          >
            <span className="truncate">{g.tag}</span>
            <span className="shrink-0 ml-2 rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
              {g.endpoints.length}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
