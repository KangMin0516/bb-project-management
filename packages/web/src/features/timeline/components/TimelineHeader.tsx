import { SearchInput, DropdownFilters, AssigneeAvatars, FilterDivider, ClearFiltersButton } from '@/shared/ui/FilterBar'
import type { FilterState } from '@/shared/ui/filterState'
import type { ProjectDetail } from '@/features/project/api'
import GroupByToggle from './GroupByToggle'
import type { GroupBy } from '@/features/timeline/lib'

interface TimelineHeaderProps {
  project: ProjectDetail | undefined
  filters: FilterState
  setFilters: (next: Partial<FilterState>) => void
  resetFilters: () => void
  toggleAssignee: (id: string) => void
  groupBy: GroupBy
  setGroupBy: (next: GroupBy) => void
  assignedMembers: { id: string; name: string; avatar: string | null }[]
  hasFilters: boolean
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
  hasFilters,
}: TimelineHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{project?.key} Timeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{project?.name}</p>
      </div>
      <div className="flex items-center gap-3">
        <GroupByToggle value={groupBy} onChange={setGroupBy} />
        <FilterDivider />
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
        <AssigneeAvatars members={assignedMembers} selected={filters.assignees} onToggle={toggleAssignee} />
        {hasFilters && <ClearFiltersButton onClick={resetFilters} />}
      </div>
    </div>
  )
}
