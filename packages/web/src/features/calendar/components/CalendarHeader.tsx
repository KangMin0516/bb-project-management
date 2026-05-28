import { Archive, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  SearchInput,
  FiltersPopover,
  ClearFiltersButton,
} from '@/shared/ui/FilterBar'
import type { FilterState } from '@/shared/ui/filterState'
import { toggleSet } from '@/shared/ui/filterState'
import type { ProjectDetail } from '@/features/project/api'
import { formatMonth } from '@/features/calendar/lib'
import { cn } from '@/shared/lib/utils'

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
  /** Reviewer / creator member lists derived from visible issues. */
  reviewerMembers: { id: string; name: string; avatar: string | null }[]
  creatorMembers: { id: string; name: string; avatar: string | null }[]
  projectLabels: { id: string; name: string; color: string }[]
  projectComponents: { id: string; name: string }[]
  projectModules: { id: string; title: string }[]
  projectEpics: { id: string; title: string }[]
  hasFilters: boolean
  showArchived: boolean
  setShowArchived: (value: boolean) => void
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
  reviewerMembers,
  creatorMembers,
  projectLabels,
  projectComponents,
  projectModules,
  projectEpics,
  hasFilters,
  showArchived,
  setShowArchived,
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

      <div className="flex items-center gap-2">
        <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
        <FiltersPopover
          filters={filters}
          setStatus={(v) => setFilters({ status: v })}
          setPriority={(v) => setFilters({ priority: v })}
          setType={(v) => setFilters({ type: v })}
          setSource={(v) => setFilters({ source: v })}
          toggleAssignee={toggleAssignee}
          toggleReviewer={(id) => setFilters({ reviewers: toggleSet(filters.reviewers, id) })}
          toggleCreator={(id) => setFilters({ creators: toggleSet(filters.creators, id) })}
          toggleLabel={(id) => setFilters({ labels: toggleSet(filters.labels, id) })}
          toggleComponent={(id) => setFilters({ components: toggleSet(filters.components, id) })}
          setEpicId={(id) => setFilters({ epicId: id })}
          setModuleId={(id) => setFilters({ domainId: id })}
          assignedMembers={assignedMembers}
          boardReviewers={reviewerMembers}
          boardCreators={creatorMembers}
          boardLabels={projectLabels}
          boardComponents={projectComponents}
          boardEpics={projectEpics}
          boardModules={projectModules}
          hideEpicOwner
        />
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
            showArchived
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived
        </button>
        {hasFilters && <ClearFiltersButton onClick={resetFilters} />}
      </div>
    </div>
  )
}
