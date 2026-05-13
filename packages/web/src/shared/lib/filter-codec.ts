// URL <-> filter-state codec for the Board / Issues / Timeline views.
//
// Defaults (empty sets, null, '', false, 'all') are omitted from the URL so
// links stay short. Comma-separated values for Sets. URL-encoded for `q`.
// deserialize(serialize(state)) === state for any concrete state.

import { INITIAL_FILTER, type FilterState } from '@/shared/ui/FilterBar'

// ─── Field name registry ───────────────────────────────────────────
// Keep param names short — they appear in every shared link.

export const PARAM = {
  // Shared filter fields (FilterState)
  assignees: 'assignees',
  labels: 'labels',
  components: 'components',
  epic: 'epic',
  status: 'status',
  priority: 'priority',
  type: 'type',
  search: 'q',
  // Page-specific extras
  archived: 'archived',
  swimlane: 'swimlane',
  view: 'view',
  sort: 'sort',
  order: 'order',
  group: 'group',
} as const

// ─── Set helpers ───────────────────────────────────────────────────

function setToParam(s: Set<string>): string | null {
  return s.size === 0 ? null : [...s].join(',')
}

function paramToSet(v: string | null): Set<string> {
  if (!v) return new Set()
  return new Set(v.split(',').filter(Boolean))
}

// ─── FilterState (shared) ──────────────────────────────────────────

export function serializeFilter(
  state: FilterState,
  into: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const writers: Array<[string, string | null]> = [
    [PARAM.assignees, setToParam(state.assignees)],
    [PARAM.labels, setToParam(state.labels)],
    [PARAM.components, setToParam(state.components)],
    [PARAM.epic, state.epicId],
    [PARAM.status, setToParam(state.status)],
    [PARAM.priority, setToParam(state.priority)],
    [PARAM.type, setToParam(state.type)],
    [PARAM.search, state.search || null],
  ]
  for (const [key, value] of writers) {
    if (value) into.set(key, value)
    else into.delete(key)
  }
  return into
}

export function deserializeFilter(params: URLSearchParams): FilterState {
  return {
    assignees: paramToSet(params.get(PARAM.assignees)),
    labels: paramToSet(params.get(PARAM.labels)),
    components: paramToSet(params.get(PARAM.components)),
    epicId: params.get(PARAM.epic),
    status: paramToSet(params.get(PARAM.status)),
    priority: paramToSet(params.get(PARAM.priority)),
    type: paramToSet(params.get(PARAM.type)),
    search: params.get(PARAM.search) ?? INITIAL_FILTER.search,
  }
}

// ─── Boolean / enum helpers (for page-specific extras) ─────────────

export function setBool(
  params: URLSearchParams,
  key: string,
  value: boolean,
  defaultValue = false,
): void {
  if (value === defaultValue) params.delete(key)
  else params.set(key, value ? '1' : '0')
}

export function getBool(
  params: URLSearchParams,
  key: string,
  defaultValue = false,
): boolean {
  const raw = params.get(key)
  if (raw == null) return defaultValue
  return raw === '1' || raw === 'true'
}

export function setEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  value: T,
  defaultValue: T,
): void {
  if (value === defaultValue) params.delete(key)
  else params.set(key, value)
}

export function getEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  defaultValue: T,
): T {
  const raw = params.get(key)
  if (raw && (allowed as readonly string[]).includes(raw)) return raw as T
  return defaultValue
}
