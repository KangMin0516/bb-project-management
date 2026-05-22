import { Archive } from 'lucide-react'
import type { FilterState } from '@/shared/ui/filterState'
import { hasActiveFilters, toggleSet } from '@/shared/ui/filterState'
import { FiltersPopover, ClearFiltersButton, SearchInput } from '@/shared/ui/FilterBar'
import SortMenu from '@/shared/ui/SortMenu'
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
  /** Modules (DOMAIN issues) for the Module section inside the popover. */
  projectModules: { id: string; title: string }[]
  /** Epics for the Epic section inside the popover. */
  projectEpics: { id: string; title: string }[]
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  showArchived: boolean
  setShowArchived: (value: boolean) => void
  viewOptions: ViewOption<ViewMode>[]
  /** Trailing slot for page-level actions (e.g. "New Issue" button). */
  rightActions?: React.ReactNode
}

export default function IssuesToolbar({
  filters,
  setFilters,
  resetFilters,
  members,
  projectLabels,
  projectComponents,
  projectModules,
  projectEpics,
  viewMode,
  setViewMode,
  showArchived,
  setShowArchived,
  viewOptions,
  rightActions,
}: IssuesToolbarProps) {
  const toggle = (key: 'assignees' | 'labels' | 'components', id: string) =>
    setFilters({ [key]: toggleSet(filters[key], id) })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
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
      <FiltersPopover
        filters={filters}
        setStatus={(v) => setFilters({ status: v })}
        setPriority={(v) => setFilters({ priority: v })}
        setType={(v) => setFilters({ type: v })}
        setSource={(v) => setFilters({ source: v })}
        toggleAssignee={(id) => toggle('assignees', id)}
        toggleLabel={(id) => toggle('labels', id)}
        toggleComponent={(id) => toggle('components', id)}
        setEpicId={(id) => setFilters({ epicId: id })}
        setModuleId={(id) => setFilters({ domainId: id })}
        assignedMembers={members}
        boardLabels={projectLabels}
        boardComponents={projectComponents}
        boardEpics={projectEpics}
        boardModules={projectModules}
        hideEpicOwner
      />
      <SortMenu sortStack={filters.sortStack} onChange={(v) => setFilters({ sortStack: v })} />
      {hasActiveFilters(filters) && <ClearFiltersButton onClick={resetFilters} />}
      {rightActions && <div className="ml-1">{rightActions}</div>}
    </div>
  )
}
