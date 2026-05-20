import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  SearchInput,
  DropdownFilters,
  AssigneeAvatars,
  FilterDivider,
  ClearFiltersButton,
} from '@/shared/ui/FilterBar'
import type { FilterState } from '@/shared/ui/filterState'
import type { ProjectDetail } from '@/features/project/api'
import { formatMonth } from '@/features/calendar/lib'

interface CalendarHeaderProps {
  project: ProjectDetail | undefined
  cursorMonth: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  filters: FilterState
  setFilters: (next: Partial<FilterState>) => void
  resetFilters: () => void
  toggleAssignee: (id: string) => void
  assignedMembers: { id: string; name: string; avatar: string | null }[]
  hasFilters: boolean
}

export default function CalendarHeader({
  project,
  cursorMonth,
  onPrev,
  onNext,
  onToday,
  filters,
  setFilters,
  resetFilters,
  toggleAssignee,
  assignedMembers,
  hasFilters,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {project?.key} Calendar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToday}
            className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatMonth(cursorMonth.getFullYear(), cursorMonth.getMonth())}
          </span>
          <button
            onClick={onNext}
            aria-label="Next month"
            className="rounded p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
        <DropdownFilters
          status={filters.status}
          priority={filters.priority}
          type={filters.type}
          source={filters.source}
          onStatusChange={(v) => setFilters({ status: v })}
          onPriorityChange={(v) => setFilters({ priority: v })}
          onTypeChange={(v) => setFilters({ type: v })}
          onSourceChange={(v) => setFilters({ source: v })}
        />
        <FilterDivider />
        <AssigneeAvatars
          members={assignedMembers}
          selected={filters.assignees}
          onToggle={toggleAssignee}
        />
        {hasFilters && <ClearFiltersButton onClick={resetFilters} />}
      </div>
    </div>
  )
}
