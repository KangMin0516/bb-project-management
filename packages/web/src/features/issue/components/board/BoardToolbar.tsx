import { Archive, Rows3, ChevronsUpDown, FoldVertical } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import { FiltersPopover, ClearFiltersButton, SearchInput } from '@/shared/ui/FilterBar'
import { cn } from '@/shared/lib/utils'
import type { FilterState } from '@/shared/ui/filterState'
interface BoardToolbarProps {
  filters: FilterState
  setFilters: (next: Partial<FilterState>) => void
  resetFilters: () => void
  toggleAssignee: (id: string) => void
  toggleLabel: (id: string) => void
  toggleComponent: (id: string) => void
  setEpicId: (id: string | null) => void
  toggleEpicOwner: (id: string) => void
  assignedMembers: { id: string; name: string; avatar: string | null }[]
  boardLabels: { id: string; name: string; color: string }[]
  boardComponents: { id: string; name: string }[]
  boardEpics: Issue[]
  epicOwners: { id: string; name: string; avatar: string | null }[]
  hasFilters: boolean
  showArchived: boolean
  setShowArchived: (value: boolean) => void
  groupByEpic: boolean
  setGroupByEpic: (value: boolean) => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

export default function BoardToolbar({
  filters,
  setFilters,
  resetFilters,
  toggleAssignee,
  toggleLabel,
  toggleComponent,
  setEpicId,
  toggleEpicOwner,
  assignedMembers,
  boardLabels,
  boardComponents,
  boardEpics,
  epicOwners,
  hasFilters,
  showArchived,
  setShowArchived,
  groupByEpic,
  setGroupByEpic,
  onExpandAll,
  onCollapseAll,
}: BoardToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
      <FiltersPopover
        filters={filters}
        setStatus={(v) => setFilters({ status: v })}
        setPriority={(v) => setFilters({ priority: v })}
        setType={(v) => setFilters({ type: v })}
        toggleAssignee={toggleAssignee}
        toggleLabel={toggleLabel}
        toggleComponent={toggleComponent}
        setEpicId={setEpicId}
        toggleEpicOwner={toggleEpicOwner}
        assignedMembers={assignedMembers}
        boardLabels={boardLabels}
        boardComponents={boardComponents}
        boardEpics={boardEpics}
        epicOwners={epicOwners}
        hideEpicOwner={!groupByEpic}
      />
      {hasFilters && <ClearFiltersButton onClick={resetFilters} />}
      <ToggleButton
        active={showArchived}
        onClick={() => setShowArchived(!showArchived)}
        icon={<Archive className="h-3.5 w-3.5" />}
        label="Archived"
        activeColor="amber"
      />
      <ToggleButton
        active={groupByEpic}
        onClick={() => setGroupByEpic(!groupByEpic)}
        icon={<Rows3 className="h-3.5 w-3.5" />}
        label="Group: Epic"
        activeColor="primary"
      />
      {groupByEpic && (
        <>
          <button
            type="button"
            onClick={onExpandAll}
            title="Expand all swimlanes"
            className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Expand all
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            title="Collapse all swimlanes"
            className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FoldVertical className="h-3.5 w-3.5" />
            Collapse all
          </button>
        </>
      )}
    </div>
  )
}

const ACTIVE_TONE = {
  amber: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  primary: 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  activeColor,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  activeColor: keyof typeof ACTIVE_TONE
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
        active
          ? ACTIVE_TONE[activeColor]
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
