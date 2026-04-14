import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Users, Tag, Layers, Zap, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUSES } from '@/lib/constants'

// Shared filter state interface
export interface FilterState {
  assignees: Set<string>
  labels: Set<string>
  components: Set<string>
  epicId: string | null
  status: string
  priority: string
  type: string
  search: string
}

export const INITIAL_FILTER: FilterState = {
  assignees: new Set(),
  labels: new Set(),
  components: new Set(),
  epicId: null,
  status: '',
  priority: '',
  type: '',
  search: '',
}

export function hasActiveFilters(f: FilterState): boolean {
  return f.assignees.size > 0 || f.labels.size > 0 || f.components.size > 0 || !!f.epicId || !!f.status || !!f.priority || !!f.type || !!f.search
}

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
            ? 'border-primary-300 bg-primary-50 text-primary-700'
            : 'border-gray-300 text-gray-600 hover:bg-gray-50',
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
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={selected.has(member.id)}
            onChange={() => onToggle(member.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700 overflow-hidden">
            {member.avatar ? (
              <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
            ) : (
              member.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="truncate text-xs text-gray-700">{member.name}</span>
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={selected.has(label.id)}
            onChange={() => onToggle(label.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          <span className="truncate text-xs text-gray-700">{label.name}</span>
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={selected.has(comp.id)}
            onChange={() => onToggle(comp.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="truncate text-xs text-gray-700">{comp.name}</span>
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={selectedId === epic.id}
            onChange={() => onSelect(selectedId === epic.id ? null : epic.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="truncate text-xs text-gray-700">{epic.title}</span>
        </label>
      ))}
    </FilterDropdown>
  )
}

// Divider between filter groups
export function FilterDivider() {
  return <div className="h-5 w-px bg-gray-200" />
}

// Clear all filters button
export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
      title="Clear all filters"
    >
      <X className="h-3 w-3" />
      Clear
    </button>
  )
}

// Dropdown filters (status, priority, type) for List view
export function DropdownFilters({
  status,
  priority,
  type,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
}: {
  status: string
  priority: string
  type: string
  onStatusChange: (v: string) => void
  onPriorityChange: (v: string) => void
  onTypeChange: (v: string) => void
}) {
  return (
    <>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
      >
        <option value="">All Status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
      >
        <option value="">All Priority</option>
        {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
      >
        <option value="">All Type</option>
        {['EPIC', 'TASK', 'BUG', 'SUB_TASK'].map((t) => (
          <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
        ))}
      </select>
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
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search issues..."
        className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
      />
    </div>
  )
}

// Set toggle utility
export function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
