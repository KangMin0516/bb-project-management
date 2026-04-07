import { useCallback } from 'react'
import { Search } from 'lucide-react'
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

// Assignee avatar toggle (shared between Board & List)
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
    <div className="flex items-center gap-1">
      {members.map((member) => {
        const isSelected = selected.has(member.id)
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onToggle(member.id)}
            title={member.name}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
              isSelected
                ? 'ring-2 ring-primary-600 ring-offset-1 bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {member.name.charAt(0).toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

// Label chip toggle (shared between Board & List)
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
    <div className="flex items-center gap-1">
      {labels.map((label) => {
        const isSelected = selected.has(label.id)
        return (
          <button
            key={label.id}
            type="button"
            onClick={() => onToggle(label.id)}
            title={label.name}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              isSelected
                ? 'ring-2 ring-offset-1'
                : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundColor: label.color + '20',
              color: label.color,
              ...(isSelected ? { ringColor: label.color } : {}),
            }}
          >
            {label.name}
          </button>
        )
      })}
    </div>
  )
}

// Component chip toggle
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
    <div className="flex items-center gap-1">
      {components.map((comp) => {
        const isSelected = selected.has(comp.id)
        return (
          <button
            key={comp.id}
            type="button"
            onClick={() => onToggle(comp.id)}
            title={comp.name}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              isSelected
                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-1'
                : 'bg-blue-50 text-blue-600 opacity-70 hover:opacity-100'
            }`}
          >
            {comp.name}
          </button>
        )
      })}
    </div>
  )
}

// Epic chip toggle
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
    <div className="flex items-center gap-1">
      {epics.map((epic) => {
        const isSelected = selectedId === epic.id
        return (
          <button
            key={epic.id}
            type="button"
            onClick={() => onSelect(isSelected ? null : epic.id)}
            title={epic.title}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              isSelected
                ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500 ring-offset-1'
                : 'bg-purple-50 text-purple-600 opacity-70 hover:opacity-100'
            }`}
          >
            ⚡ {epic.title}
          </button>
        )
      })}
    </div>
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
      className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100"
      title="Clear all filters"
    >
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
