import { INITIAL_FILTER, type FilterState } from '@/shared/ui/filterState'

/**
 * Parsed-out filter values pulled from a search-input query string. The
 * shape mirrors `FilterState` so callers can merge directly into the
 * existing filter pipeline (PM-78).
 */
export interface ParsedSearch {
  /** Residual text after operators are removed — title-match input. */
  text: string
  status: Set<string>
  priority: Set<string>
  type: Set<string>
  source: Set<string>
  assignees: Set<string>
  reviewers: Set<string>
  creators: Set<string>
  labels: Set<string>
  /** Single-select; null = not set in query. */
  domainId: string | null
  epicId: string | null
  /** `is:archived` opt-in (toggle Archived view from the query). */
  showArchived: boolean
}

export interface ParseContext {
  currentUserId?: string
  members?: Array<{ id: string; name: string }>
  labels?: Array<{ id: string; name: string }>
  modules?: Array<{ id: string; title: string }>
  epics?: Array<{ id: string; title: string }>
}

const OPEN_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'RECHECK']
const DONE_STATUSES = ['DONE']

/**
 * Token pattern: either a `key:"quoted value"` or `key:bareValue` (no
 * spaces in bare) or a plain word. The regex captures four groups:
 *   1 = key (if operator), 2 = quoted value, 3 = bare value, 4 = bare word
 */
const TOKEN_RE =
  /(\w+):(?:"([^"]+)"|([^\s"]+))|"([^"]+)"|(\S+)/g

/**
 * Parse a free-form search query into a filter set + residual text.
 * Pure function — no hooks. Caller decides how to merge into FilterState.
 *
 * Unrecognised operators stay as plain text so the parser is forgiving
 * (typing `xref:foo` doesn't silently drop the chunk).
 */
export function parseSearchQuery(
  query: string,
  ctx: ParseContext = {},
): ParsedSearch {
  const result: ParsedSearch = {
    text: '',
    status: new Set(),
    priority: new Set(),
    type: new Set(),
    source: new Set(),
    assignees: new Set(),
    reviewers: new Set(),
    creators: new Set(),
    labels: new Set(),
    domainId: null,
    epicId: null,
    showArchived: false,
  }
  const residual: string[] = []

  TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_RE.exec(query)) !== null) {
    const [, key, qVal, bVal, qWord, bWord] = match
    if (key) {
      const value = qVal ?? bVal ?? ''
      const consumed = applyOperator(key.toLowerCase(), value, result, ctx)
      if (!consumed) {
        // Unrecognised — keep the original chunk as residual text.
        residual.push(match[0])
      }
    } else {
      residual.push(qWord ?? bWord ?? '')
    }
  }

  result.text = residual.join(' ').trim()
  return result
}

function applyOperator(
  key: string,
  value: string,
  out: ParsedSearch,
  ctx: ParseContext,
): boolean {
  switch (key) {
    case 'status': {
      const norm = value.toUpperCase().replace(/-/g, '_')
      if (norm === 'OPEN') {
        OPEN_STATUSES.forEach((s) => out.status.add(s))
      } else if (norm === 'CLOSED') {
        DONE_STATUSES.forEach((s) => out.status.add(s))
      } else {
        out.status.add(norm)
      }
      return true
    }
    case 'priority': {
      const norm = value.toUpperCase()
      if (norm === 'HIGH' || norm === 'MEDIUM' || norm === 'LOW') {
        out.priority.add(norm)
      }
      return true
    }
    case 'type': {
      const map: Record<string, string> = {
        task: 'TASK',
        bug: 'BUG',
        epic: 'EPIC',
        domain: 'DOMAIN',
        module: 'DOMAIN',
        subtask: 'SUB_TASK',
        'sub-task': 'SUB_TASK',
        sub_task: 'SUB_TASK',
      }
      const norm = map[value.toLowerCase()]
      if (norm) out.type.add(norm)
      return true
    }
    case 'source': {
      const norm = value.toUpperCase()
      if (['WEB', 'MCP', 'SLACK', 'WEBHOOK', 'API', 'SYSTEM'].includes(norm)) {
        out.source.add(norm)
      }
      return true
    }
    case 'assignee': {
      if (value.toLowerCase() === 'me' && ctx.currentUserId) {
        out.assignees.add(ctx.currentUserId)
      } else if (value.toLowerCase() === 'none' || value.toLowerCase() === 'unassigned') {
        // Sentinel handled by the filter pipeline if needed. Phase 1 keeps
        // a literal `__unassigned__` marker for now — callers ignore it
        // unless they choose to wire it in.
        out.assignees.add('__unassigned__')
      } else if (ctx.members) {
        const member = findByName(ctx.members, value)
        if (member) out.assignees.add(member.id)
      }
      return true
    }
    case 'reviewer': {
      if (value.toLowerCase() === 'me' && ctx.currentUserId) {
        out.reviewers.add(ctx.currentUserId)
      } else if (ctx.members) {
        const member = findByName(ctx.members, value)
        if (member) out.reviewers.add(member.id)
      }
      return true
    }
    case 'creator':
    case 'author': {
      if (value.toLowerCase() === 'me' && ctx.currentUserId) {
        out.creators.add(ctx.currentUserId)
      } else if (ctx.members) {
        const member = findByName(ctx.members, value)
        if (member) out.creators.add(member.id)
      }
      return true
    }
    case 'label': {
      if (ctx.labels) {
        const label = findByName(ctx.labels, value)
        if (label) out.labels.add(label.id)
      }
      return true
    }
    case 'module': {
      if (ctx.modules) {
        const m = findByTitle(ctx.modules, value)
        if (m) out.domainId = m.id
      }
      return true
    }
    case 'epic': {
      if (ctx.epics) {
        const e = findByTitle(ctx.epics, value)
        if (e) out.epicId = e.id
      }
      return true
    }
    case 'is': {
      if (value.toLowerCase() === 'archived') out.showArchived = true
      return true
    }
    default:
      return false
  }
}

function findByName<T extends { name: string }>(
  items: T[],
  query: string,
): T | undefined {
  const q = query.toLowerCase()
  return (
    items.find((i) => i.name.toLowerCase() === q) ??
    items.find((i) => i.name.toLowerCase().includes(q))
  )
}

function findByTitle<T extends { title: string }>(
  items: T[],
  query: string,
): T | undefined {
  const q = query.toLowerCase()
  return (
    items.find((i) => i.title.toLowerCase() === q) ??
    items.find((i) => i.title.toLowerCase().includes(q))
  )
}

/**
 * Merge a parsed search into an existing `FilterState`. Popover-set
 * filters take precedence — operator-derived filters AND with them
 * (Set union). The `search` field is replaced by the parsed residual.
 *
 * Returns a NEW FilterState; never mutates the input.
 */
export function applyParsedSearch(
  base: FilterState,
  parsed: ParsedSearch,
): FilterState {
  return {
    ...base,
    // Always use the parsed residual — never fall back to base.search. The
    // caller only invokes this when operators were detected, so the raw
    // input contains operator tokens that would otherwise leak in as a
    // bogus title-substring match (e.g. `title.includes('status:open')`).
    search: parsed.text,
    status: unionSets(base.status, parsed.status),
    priority: unionSets(base.priority, parsed.priority),
    type: unionSets(base.type, parsed.type),
    source: unionSets(base.source, parsed.source),
    assignees: unionSets(base.assignees, parsed.assignees),
    reviewers: unionSets(base.reviewers, parsed.reviewers),
    creators: unionSets(base.creators, parsed.creators),
    labels: unionSets(base.labels, parsed.labels),
    domainId: parsed.domainId ?? base.domainId,
    epicId: parsed.epicId ?? base.epicId,
  }
}

function unionSets<T>(a: Set<T>, b: Set<T>): Set<T> {
  if (b.size === 0) return a
  const merged = new Set(a)
  for (const v of b) merged.add(v)
  return merged
}

/** Heuristic: does the query contain any operator syntax (`key:value`)? */
export function hasOperators(query: string): boolean {
  return /\b\w+:/.test(query)
}

// Re-exported so callers don't have to import filterState separately.
export { INITIAL_FILTER }
