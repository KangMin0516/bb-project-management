import { Archive, FolderOpen, Rows3, ChevronsUpDown, FoldVertical } from 'lucide-react'
import type { Issue } from '@/features/issue/api'
import { FiltersPopover, ClearFiltersButton, SearchInput } from '@/shared/ui/FilterBar'
import SortMenu from '@/shared/ui/SortMenu'
import { cn } from '@/shared/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
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
  /** Modules (DOMAIN) defined in the project — drives the Module filter chip. */
  boardModules?: { id: string; title: string }[]
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
  boardModules,
  epicOwners,
  hasFilters,
  showArchived,
  setShowArchived,
  groupByEpic,
  setGroupByEpic,
  onExpandAll,
  onCollapseAll,
}: BoardToolbarProps) {
  const moduleOptions = boardModules ?? []
  const MODULE_ALL = '__all__'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v })} />
      <FiltersPopover
        filters={filters}
        setStatus={(v) => setFilters({ status: v })}
        setPriority={(v) => setFilters({ priority: v })}
        setType={(v) => setFilters({ type: v })}
        setSource={(v) => setFilters({ source: v })}
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
      <SortMenu
        sortStack={filters.sortStack}
        onChange={(v) => setFilters({ sortStack: v })}
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
      {moduleOptions.length > 0 && (
        <Select
          value={filters.domainId ?? MODULE_ALL}
          onValueChange={(v) => setFilters({ domainId: v === MODULE_ALL ? null : v })}
        >
          <SelectTrigger
            className={cn(
              'flex h-auto w-auto items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-none transition focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5',
              filters.domainId
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700',
            )}
          >
            <FolderOpen
              className={cn(
                'h-3.5 w-3.5',
                filters.domainId ? 'text-indigo-500' : 'text-gray-500 dark:text-gray-400',
              )}
            />
            <span className="text-gray-500 dark:text-gray-400">Module:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MODULE_ALL}>All</SelectItem>
            {moduleOptions.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
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
