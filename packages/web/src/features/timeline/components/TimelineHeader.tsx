import { SearchInput, FiltersPopover, FilterDivider, ClearFiltersButton } from '@/shared/ui/FilterBar'
import SortMenu from '@/shared/ui/SortMenu'
import { toggleSet, type FilterState } from '@/shared/ui/filterState'
import type { ProjectDetail } from '@/features/project/api'
import GroupByToggle from './GroupByToggle'
import type { GroupBy } from '@/features/timeline/lib'

// Timeline doesn't surface status/number sort (status is implicit in the
// row group; number is the on-screen anchor). Keep the menu focused.
const TIMELINE_SORT_FIELDS = ['priority', 'dueDate', 'startDate', 'title', 'createdAt', 'updatedAt'] as const

interface TimelineHeaderProps {
  project: ProjectDetail | undefined
  filters: FilterState
  setFilters: (next: Partial<FilterState>) => void
  resetFilters: () => void
  toggleAssignee: (id: string) => void
  groupBy: GroupBy
  setGroupBy: (next: GroupBy) => void
  assignedMembers: { id: string; name: string; avatar: string | null }[]
  projectLabels: { id: string; name: string; color: string }[]
  projectComponents: { id: string; name: string }[]
  projectModules: { id: string; title: string }[]
  projectEpics: { id: string; title: string }[]
  hasFilters: boolean
  /** Slot for trailing actions (e.g. the Share button for PM↑). */
  rightActions?: React.ReactNode
}

export default function TimelineHeader({
  project,
  filters,
  setFilters,
  resetFilters,
  toggleAssignee,
  groupBy,
  setGroupBy,
  assignedMembers,
  projectLabels,
  projectComponents,
  projectModules,
  projectEpics,
  hasFilters,
  rightActions,
}: TimelineHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{project?.key} Timeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
      </div>
      <div className="flex items-center gap-2">
        <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
        <GroupByToggle value={groupBy} onChange={setGroupBy} />
        <FiltersPopover
          filters={filters}
          setStatus={(v) => setFilters({ status: v })}
          setPriority={(v) => setFilters({ priority: v })}
          setType={(v) => setFilters({ type: v })}
          setSource={(v) => setFilters({ source: v })}
          toggleAssignee={toggleAssignee}
          toggleLabel={(id) => setFilters({ labels: toggleSet(filters.labels, id) })}
          toggleComponent={(id) => setFilters({ components: toggleSet(filters.components, id) })}
          setEpicId={(id) => setFilters({ epicId: id })}
          setModuleId={(id) => setFilters({ domainId: id })}
          assignedMembers={assignedMembers}
          boardLabels={projectLabels}
          boardComponents={projectComponents}
          boardEpics={projectEpics}
          boardModules={projectModules}
          hideEpicOwner
        />
        <SortMenu
          sortStack={filters.sortStack}
          onChange={(v) => setFilters({ sortStack: v })}
          availableFields={[...TIMELINE_SORT_FIELDS]}
        />
        {hasFilters && <ClearFiltersButton onClick={resetFilters} />}
        {rightActions && (
          <>
            <FilterDivider />
            {rightActions}
          </>
        )}
      </div>
    </div>
  )
}
