// URL <-> filter-state codec for the Board / Issues / Timeline views.
//
// Defaults (empty sets, null, '', false, 'all') are omitted from the URL so
// links stay short. Comma-separated values for Sets. URL-encoded for `q`.
// deserialize(serialize(state)) === state for any concrete state.

import { INITIAL_FILTER, type FilterState, type SortRule, type SortField } from '@/shared/ui/filterState'

const SORT_FIELDS: readonly SortField[] = [
  'priority',
  'dueDate',
  'startDate',
  'createdAt',
  'updatedAt',
  'title',
  'number',
  'status',
]
// ─── Field name registry ───────────────────────────────────────────
// Keep param names short — they appear in every shared link.

export const PARAM = {
  // Shared filter fields (FilterState)
  assignees: 'assignees',
  reviewers: 'reviewers',
  creators: 'creators',
  labels: 'labels',
  components: 'components',
  epic: 'epic',
  domain: 'domain',
  epicOwners: 'epicOwners',
  status: 'status',
  priority: 'priority',
  type: 'type',
  source: 'source',
  sort: 'sort',
  search: 'q',
  // Page-specific extras
  archived: 'archived',
  swimlane: 'swimlane',
  view: 'view',
  /** Legacy single-field sort order. Kept for `useIssueListUrlState`
   *  back-compat; new code uses the multi-field `sort` codec above. */
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

function sortStackToParam(stack: SortRule[]): string | null {
  if (stack.length === 0) return null
  return stack.map((r) => `${r.field}:${r.dir}`).join(',')
}

function paramToSortStack(v: string | null): SortRule[] {
  if (!v) return []
  const out: SortRule[] = []
  for (const part of v.split(',')) {
    const [field, dir] = part.split(':') as [string, string | undefined]
    if (!SORT_FIELDS.includes(field as SortField)) continue
    out.push({ field: field as SortField, dir: dir === 'asc' ? 'asc' : 'desc' })
  }
  return out
}

// ─── FilterState (shared) ──────────────────────────────────────────

export function serializeFilter(
  state: FilterState,
  into: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const writers: Array<[string, string | null]> = [
    [PARAM.assignees, setToParam(state.assignees)],
    [PARAM.reviewers, setToParam(state.reviewers)],
    [PARAM.creators, setToParam(state.creators)],
    [PARAM.labels, setToParam(state.labels)],
    [PARAM.components, setToParam(state.components)],
    [PARAM.epic, state.epicId],
    [PARAM.domain, state.domainId],
    [PARAM.epicOwners, setToParam(state.epicOwners)],
    [PARAM.status, setToParam(state.status)],
    [PARAM.priority, setToParam(state.priority)],
    [PARAM.type, setToParam(state.type)],
    [PARAM.source, setToParam(state.source)],
    [PARAM.sort, sortStackToParam(state.sortStack)],
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
    reviewers: paramToSet(params.get(PARAM.reviewers)),
    creators: paramToSet(params.get(PARAM.creators)),
    labels: paramToSet(params.get(PARAM.labels)),
    components: paramToSet(params.get(PARAM.components)),
    epicId: params.get(PARAM.epic),
    domainId: params.get(PARAM.domain),
    epicOwners: paramToSet(params.get(PARAM.epicOwners)),
    status: paramToSet(params.get(PARAM.status)),
    priority: paramToSet(params.get(PARAM.priority)),
    type: paramToSet(params.get(PARAM.type)),
    source: paramToSet(params.get(PARAM.source)),
    sortStack: paramToSortStack(params.get(PARAM.sort)),
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
