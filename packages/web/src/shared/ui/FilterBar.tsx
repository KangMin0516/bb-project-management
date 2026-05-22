import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Users, Tag, Layers, Zap, X, CircleDot, Signal, Shapes, UserCircle, SlidersHorizontal, Sparkles } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { stringToHslColor } from '@/shared/lib/color'
import { STATUSES, STATUS_COLORS } from '@/shared/config/constants'
import type { FilterState } from '@/shared/ui/filterState'
import { toggleSet } from '@/shared/ui/filterState'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Checkbox } from '@/shared/ui/checkbox'
import SourceBadge from '@/shared/ui/SourceBadge'
import type { IssueSource } from '@/features/issue/api'

const SOURCE_OPTIONS: IssueSource[] = ['WEB', 'MCP', 'SLACK', 'WEBHOOK', 'API', 'SYSTEM']


// Generic filter dropdown with checkboxes
function FilterDropdown({
  label,
  icon: Icon,
  selectedCount,
  children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  selectedCount: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
          selectedCount > 0
            ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        {selectedCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {selectedCount}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg dark:shadow-gray-900/50">
          {children}
        </div>
      )}
    </div>
  )
}

// Assignee filter dropdown
export function AssigneeAvatars({
  members,
  selected,
  onToggle,
}: {
  members: { id: string; name: string; avatar: string | null }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (members.length === 0) return null
  return (
    <FilterDropdown label="Assignee" icon={Users} selectedCount={selected.size}>
      {members.map((member) => (
        <label
          key={member.id}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Checkbox checked={selected.has(member.id)} onCheckedChange={() => onToggle(member.id)} />
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700 overflow-hidden">
            {member.avatar ? (
              <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
            ) : (
              member.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{member.name}</span>
        </label>
      ))}
    </FilterDropdown>
  )
}

// Label filter dropdown
export function LabelChips({
  labels,
  selected,
  onToggle,
}: {
  labels: { id: string; name: string; color: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (labels.length === 0) return null
  return (
    <FilterDropdown label="Label" icon={Tag} selectedCount={selected.size}>
      {labels.map((label) => (
        <label
          key={label.id}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Checkbox checked={selected.has(label.id)} onCheckedChange={() => onToggle(label.id)} />
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{label.name}</span>
        </label>
      ))}
    </FilterDropdown>
  )
}

// Component filter dropdown
export function ComponentChips({
  components,
  selected,
  onToggle,
}: {
  components: { id: string; name: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (components.length === 0) return null
  return (
    <FilterDropdown label="Component" icon={Layers} selectedCount={selected.size}>
      {components.map((comp) => (
        <label
          key={comp.id}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Checkbox checked={selected.has(comp.id)} onCheckedChange={() => onToggle(comp.id)} />
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{comp.name}</span>
        </label>
      ))}
    </FilterDropdown>
  )
}

// Epic owner filter dropdown — narrows swimlanes by who owns the Epic.
export function EpicOwnerAvatars({
  owners,
  selected,
  onToggle,
}: {
  owners: { id: string; name: string; avatar: string | null }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (owners.length === 0) return null
  return (
    <FilterDropdown label="Epic Owner" icon={UserCircle} selectedCount={selected.size}>
      {owners.map((owner) => (
        <label
          key={owner.id}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Checkbox checked={selected.has(owner.id)} onCheckedChange={() => onToggle(owner.id)} />
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700 overflow-hidden">
            {owner.avatar ? (
              <img src={owner.avatar} alt={owner.name} className="h-full w-full object-cover" />
            ) : (
              owner.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{owner.name}</span>
        </label>
      ))}
    </FilterDropdown>
  )
}

// Epic filter dropdown
export function EpicChips({
  epics,
  selectedId,
  onSelect,
}: {
  epics: { id: string; title: string }[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (epics.length === 0) return null
  return (
    <FilterDropdown label="Epic" icon={Zap} selectedCount={selectedId ? 1 : 0}>
      {epics.map((epic) => (
        <label
          key={epic.id}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Checkbox checked={selectedId === epic.id} onCheckedChange={() => onSelect(selectedId === epic.id ? null : epic.id)} />
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{epic.title}</span>
        </label>
      ))}
    </FilterDropdown>
  )
}

// Unified filters popover — consolidates all 7 facets behind one button
// so the toolbar doesn't sprawl across two rows. Inner sections render
// their checkbox lists inline (no nested dropdowns).
interface FiltersPopoverProps {
  filters: FilterState
  setStatus: (v: Set<string>) => void
  setPriority: (v: Set<string>) => void
  setType: (v: Set<string>) => void
  setSource: (v: Set<string>) => void
  toggleAssignee: (id: string) => void
  toggleLabel: (id: string) => void
  toggleComponent: (id: string) => void
  setEpicId: (id: string | null) => void
  setModuleId?: (id: string | null) => void
  toggleEpicOwner?: (id: string) => void
  assignedMembers: { id: string; name: string; avatar: string | null }[]
  boardLabels: { id: string; name: string; color: string }[]
  boardComponents: { id: string; name: string }[]
  boardEpics: { id: string; title: string }[]
  /** Modules (DOMAIN issues) available on this project — drives the Module
   *  section. Single-select like Epic; click an active row again to clear. */
  boardModules?: { id: string; title: string }[]
  epicOwners?: { id: string; name: string; avatar: string | null }[]
  /** When true, hides the Epic Owner section. */
  hideEpicOwner?: boolean
}

export function FiltersPopover({
  filters,
  setStatus,
  setPriority,
  setType,
  setSource,
  toggleAssignee,
  toggleLabel,
  toggleComponent,
  setEpicId,
  setModuleId,
  toggleEpicOwner,
  assignedMembers,
  boardLabels,
  boardComponents,
  boardEpics,
  boardModules,
  epicOwners,
  hideEpicOwner,
}: FiltersPopoverProps) {
  const [open, setOpen] = useState(false)
  const totalCount =
    filters.status.size +
    filters.priority.size +
    filters.type.size +
    filters.source.size +
    filters.assignees.size +
    filters.labels.size +
    filters.components.size +
    (filters.epicId ? 1 : 0) +
    (filters.domainId ? 1 : 0) +
    (filters.epicOwners?.size ?? 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
            totalCount > 0
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {totalCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
              {totalCount}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-[70vh] overflow-y-auto py-1">
          <FilterSection title="Status">
            {STATUSES.map((s) => (
              <CheckboxRow
                key={s}
                checked={filters.status.has(s)}
                onChange={() => setStatus(toggleSet(filters.status, s))}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[s])} />
                <span>{s.replace(/_/g, ' ')}</span>
              </CheckboxRow>
            ))}
          </FilterSection>

          <FilterSection title="Priority">
            {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <CheckboxRow
                key={p}
                checked={filters.priority.has(p)}
                onChange={() => setPriority(toggleSet(filters.priority, p))}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_DOT_COLORS[p])} />
                <span>{p}</span>
              </CheckboxRow>
            ))}
          </FilterSection>

          <FilterSection title="Type">
            {['EPIC', 'TASK', 'BUG', 'SUB_TASK'].map((t) => (
              <CheckboxRow
                key={t}
                checked={filters.type.has(t)}
                onChange={() => setType(toggleSet(filters.type, t))}
              >
                <span className="text-xs">{TYPE_EMOJI[t] || ''}</span>
                <span>{t.replace(/_/g, ' ')}</span>
              </CheckboxRow>
            ))}
          </FilterSection>

          <FilterSection title="Source">
            {SOURCE_OPTIONS.map((s) => (
              <CheckboxRow
                key={s}
                checked={filters.source.has(s)}
                onChange={() => setSource(toggleSet(filters.source, s))}
              >
                <SourceBadge source={s} hideWhenWeb={false} />
              </CheckboxRow>
            ))}
          </FilterSection>

          {assignedMembers.length > 0 && (
            <FilterSection title="Assignee">
              {assignedMembers.map((m) => (
                <CheckboxRow
                  key={m.id}
                  checked={filters.assignees.has(m.id)}
                  onChange={() => toggleAssignee(m.id)}
                >
                  <Avatar32 name={m.name} avatar={m.avatar} />
                  <span className="truncate">{m.name}</span>
                </CheckboxRow>
              ))}
            </FilterSection>
          )}

          {boardLabels.length > 0 && (
            <FilterSection title="Label">
              {boardLabels.map((l) => (
                <CheckboxRow
                  key={l.id}
                  checked={filters.labels.has(l.id)}
                  onChange={() => toggleLabel(l.id)}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="truncate">{l.name}</span>
                </CheckboxRow>
              ))}
            </FilterSection>
          )}

          {boardComponents.length > 0 && (
            <FilterSection title="Component">
              {boardComponents.map((c) => (
                <CheckboxRow
                  key={c.id}
                  checked={filters.components.has(c.id)}
                  onChange={() => toggleComponent(c.id)}
                >
                  <span className="truncate">{c.name}</span>
                </CheckboxRow>
              ))}
            </FilterSection>
          )}

          {boardModules && boardModules.length > 0 && setModuleId && (
            <FilterSection title="Module">
              {boardModules.map((m) => (
                <CheckboxRow
                  key={m.id}
                  checked={filters.domainId === m.id}
                  onChange={() => setModuleId(filters.domainId === m.id ? null : m.id)}
                >
                  <span className="truncate">{m.title}</span>
                </CheckboxRow>
              ))}
            </FilterSection>
          )}

          {boardEpics.length > 0 && (
            <FilterSection title="Epic">
              {boardEpics.map((ep) => (
                <CheckboxRow
                  key={ep.id}
                  checked={filters.epicId === ep.id}
                  onChange={() => setEpicId(filters.epicId === ep.id ? null : ep.id)}
                >
                  <span className="truncate">{ep.title}</span>
                </CheckboxRow>
              ))}
            </FilterSection>
          )}

          {!hideEpicOwner && epicOwners && epicOwners.length > 0 && toggleEpicOwner && (
            <FilterSection title="Epic Owner">
              {epicOwners.map((o) => (
                <CheckboxRow
                  key={o.id}
                  checked={filters.epicOwners?.has(o.id) ?? false}
                  onChange={() => toggleEpicOwner(o.id)}
                >
                  <Avatar32 name={o.name} avatar={o.avatar} />
                  <span className="truncate">{o.name}</span>
                </CheckboxRow>
              ))}
            </FilterSection>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 py-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {title}
      </div>
      {children}
    </div>
  )
}

function CheckboxRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {children}
    </label>
  )
}

function Avatar32({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      </span>
    )
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-medium"
      style={{
        backgroundColor: stringToHslColor(name),
        color: stringToHslColor(name, 70, 20),
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// Divider between filter groups
export function FilterDivider() {
  return <div className="h-5 w-px bg-gray-200 dark:bg-gray-600" />
}

// Clear all filters button
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
      title="Clear all filters"
    >
      <X className="h-3 w-3" />
      Clear
    </button>
  )
}

// Priority color dots for the filter dropdown
const PRIORITY_DOT_COLORS: Record<string, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
}

// Type icons for the filter dropdown
const TYPE_EMOJI: Record<string, string> = {
  EPIC: '\u26A1',
  TASK: '\u2705',
  BUG: '\uD83D\uDC1B',
  SUB_TASK: '\uD83D\uDCCE',
}

// Multi-select dropdown filters (status, priority, type, source)
export function DropdownFilters({
  status,
  priority,
  type,
  source,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
  onSourceChange,
}: {
  status: Set<string>
  priority: Set<string>
  type: Set<string>
  source: Set<string>
  onStatusChange: (v: Set<string>) => void
  onPriorityChange: (v: Set<string>) => void
  onTypeChange: (v: Set<string>) => void
  onSourceChange: (v: Set<string>) => void
}) {
  return (
    <>
      <FilterDropdown label="Status" icon={CircleDot} selectedCount={status.size}>
        {STATUSES.map((s) => (
          <label
            key={s}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Checkbox checked={status.has(s)} onCheckedChange={() => onStatusChange(toggleSet(status, s))} />
            <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[s])} />
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{s.replace(/_/g, ' ')}</span>
          </label>
        ))}
      </FilterDropdown>
      <FilterDropdown label="Priority" icon={Signal} selectedCount={priority.size}>
        {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
          <label
            key={p}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Checkbox checked={priority.has(p)} onCheckedChange={() => onPriorityChange(toggleSet(priority, p))} />
            <div className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_DOT_COLORS[p])} />
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p}</span>
          </label>
        ))}
      </FilterDropdown>
      <FilterDropdown label="Type" icon={Shapes} selectedCount={type.size}>
        {['EPIC', 'TASK', 'BUG', 'SUB_TASK'].map((t) => (
          <label
            key={t}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Checkbox checked={type.has(t)} onCheckedChange={() => onTypeChange(toggleSet(type, t))} />
            <span className="text-xs">{TYPE_EMOJI[t] || ''}</span>
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{t.replace(/_/g, ' ')}</span>
          </label>
        ))}
      </FilterDropdown>
      <FilterDropdown label="Source" icon={Sparkles} selectedCount={source.size}>
        {SOURCE_OPTIONS.map((s) => (
          <label
            key={s}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Checkbox checked={source.has(s)} onCheckedChange={() => onSourceChange(toggleSet(source, s))} />
            <SourceBadge source={s} hideWhenWeb={false} />
          </label>
        ))}
      </FilterDropdown>
    </>
  )
}

// Search input
export function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search issues..."
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
      />
    </div>
  )
}
