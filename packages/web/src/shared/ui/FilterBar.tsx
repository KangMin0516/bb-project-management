import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Users, Tag, Layers, Zap, X, CircleDot, Signal, Shapes } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { STATUSES, STATUS_COLORS } from '@/shared/config/constants'


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
            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:bg-gray-900',
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
        >
          <input
            type="checkbox"
            checked={selected.has(member.id)}
            onChange={() => onToggle(member.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
        >
          <input
            type="checkbox"
            checked={selected.has(label.id)}
            onChange={() => onToggle(label.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
        >
          <input
            type="checkbox"
            checked={selected.has(comp.id)}
            onChange={() => onToggle(comp.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{comp.name}</span>
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
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
        >
          <input
            type="checkbox"
            checked={selectedId === epic.id}
            onChange={() => onSelect(selectedId === epic.id ? null : epic.id)}
            className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">{epic.title}</span>
        </label>
      ))}
    </FilterDropdown>
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
      className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-900"
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

// Multi-select dropdown filters (status, priority, type)
export function DropdownFilters({
  status,
  priority,
  type,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
}: {
  status: Set<string>
  priority: Set<string>
  type: Set<string>
  onStatusChange: (v: Set<string>) => void
  onPriorityChange: (v: Set<string>) => void
  onTypeChange: (v: Set<string>) => void
}) {
  return (
    <>
      <FilterDropdown label="Status" icon={CircleDot} selectedCount={status.size}>
        {STATUSES.map((s) => (
          <label
            key={s}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
          >
            <input
              type="checkbox"
              checked={status.has(s)}
              onChange={() => onStatusChange(toggleSet(status, s))}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_COLORS[s])} />
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{s.replace(/_/g, ' ')}</span>
          </label>
        ))}
      </FilterDropdown>
      <FilterDropdown label="Priority" icon={Signal} selectedCount={priority.size}>
        {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
          <label
            key={p}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
          >
            <input
              type="checkbox"
              checked={priority.has(p)}
              onChange={() => onPriorityChange(toggleSet(priority, p))}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <div className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_DOT_COLORS[p])} />
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p}</span>
          </label>
        ))}
      </FilterDropdown>
      <FilterDropdown label="Type" icon={Shapes} selectedCount={type.size}>
        {['EPIC', 'TASK', 'BUG', 'SUB_TASK'].map((t) => (
          <label
            key={t}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-900"
          >
            <input
              type="checkbox"
              checked={type.has(t)}
              onChange={() => onTypeChange(toggleSet(type, t))}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs">{TYPE_EMOJI[t] || ''}</span>
            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{t.replace(/_/g, ' ')}</span>
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
