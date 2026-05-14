/**
 * Filter state shared by the board / issues / timeline screens. Lives in
 * a non-component file so FilterBar.tsx is React-Refresh-friendly
 * (only-export-components), and so non-UI callers can import the type
 * without pulling in the chip components.
 */
export interface FilterState {
  assignees: Set<string>
  labels: Set<string>
  components: Set<string>
  epicId: string | null
  /** Owners (assignees) of the Epics — only meaningful in swimlane mode. */
  epicOwners: Set<string>
  status: Set<string>
  priority: Set<string>
  type: Set<string>
  search: string
}

export const INITIAL_FILTER: FilterState = {
  assignees: new Set(),
  labels: new Set(),
  components: new Set(),
  epicId: null,
  epicOwners: new Set(),
  status: new Set(),
  priority: new Set(),
  type: new Set(),
  search: '',
}

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.assignees.size > 0 ||
    f.labels.size > 0 ||
    f.components.size > 0 ||
    !!f.epicId ||
    f.epicOwners.size > 0 ||
    f.status.size > 0 ||
    f.priority.size > 0 ||
    f.type.size > 0 ||
    !!f.search
  )
}

/** Immutable "toggle a value in a Set". */
export function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
