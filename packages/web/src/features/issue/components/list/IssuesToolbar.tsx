import { Archive } from 'lucide-react'
import type { FilterState } from '@/shared/ui/filterState'
import { hasActiveFilters, toggleSet } from '@/shared/ui/filterState'
import { AssigneeAvatars, LabelChips, ComponentChips, FilterDivider, ClearFiltersButton, DropdownFilters, SearchInput } from '@/shared/ui/FilterBar'
import ViewToggle, { type ViewOption } from '@/shared/ui/ViewToggle'
import { cn } from '@/shared/lib/utils'
import type { Label } from '@/features/project/api'
import type { ViewMode } from '@/features/issue/hooks/useIssueListUrlState'

interface IssuesToolbarProps {
  filters: FilterState
  setFilters: (next: Partial<FilterState>) => void
  resetFilters: () => void
  members: { id: string; name: string; avatar: string | null }[]
  projectLabels: Label[]
  projectComponents: { id: string; name: string }[]
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  showArchived: boolean
  setShowArchived: (value: boolean) => void
  viewOptions: ViewOption<ViewMode>[]
}

export default function IssuesToolbar({
  filters,
  setFilters,
  resetFilters,
  members,
  projectLabels,
  projectComponents,
  viewMode,
  setViewMode,
  showArchived,
  setShowArchived,
  viewOptions,
}: IssuesToolbarProps) {
  const toggle = (key: 'assignees' | 'labels' | 'components', id: string) =>
    setFilters({ [key]: toggleSet(filters[key], id) })

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2">
      <ViewToggle options={viewOptions} value={viewMode} onChange={setViewMode} />
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
      <FilterDivider />
      <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
      <DropdownFilters
        status={filters.status}
        priority={filters.priority}
        type={filters.type}
        onStatusChange={(v) => setFilters({ status: v })}
        onPriorityChange={(v) => setFilters({ priority: v })}
        onTypeChange={(v) => setFilters({ type: v })}
      />
      {members.length > 0 && <FilterDivider />}
      <AssigneeAvatars members={members} selected={filters.assignees} onToggle={(id) => toggle('assignees', id)} />
      {projectLabels.length > 0 && <FilterDivider />}
      <LabelChips labels={projectLabels} selected={filters.labels} onToggle={(id) => toggle('labels', id)} />
      {projectComponents.length > 0 && <FilterDivider />}
      <ComponentChips components={projectComponents} selected={filters.components} onToggle={(id) => toggle('components', id)} />
      {hasActiveFilters(filters) && <ClearFiltersButton onClick={resetFilters} />}
    </div>
  )
}
