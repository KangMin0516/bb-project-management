import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import { NO_EPIC_KEY, type EpicGroup, type GroupBy } from '@/features/timeline/lib'

const TYPE_ORDER = ['EPIC', 'TASK', 'BUG', 'SUB_TASK']

/**
 * Buckets issues by grouping mode. Returns both `epicGroups` (for the
 * tree-shaped Epic view) and a flat `groups` Map (for the Type / Assignee
 * views) — the renderer picks whichever matches its mode.
 *
 * EPIC mode walks `parentId` up to the nearest EPIC ancestor; issues whose
 * EPIC was filtered out are still surfaced because we look it up via
 * `issueMap` instead of only the visible set.
 */
export function useTimelineGroups(allIssues: Issue[], filteredIssues: Issue[], groupBy: GroupBy) {
  const issueMap = useMemo(() => {
    const m = new Map<string, Issue>()
    for (const issue of allIssues) m.set(issue.id, issue)
    return m
  }, [allIssues])

  const epicGroups = useMemo<EpicGroup[]>(() => {
    if (groupBy !== 'epic') return []
    const groupMap = new Map<string, EpicGroup>()

    for (const issue of filteredIssues) {
      if (issue.type === 'EPIC' && !groupMap.has(issue.id)) {
        groupMap.set(issue.id, { key: issue.id, epic: issue, children: [] })
      }
    }

    for (const issue of filteredIssues) {
      if (issue.type === 'EPIC') continue
      const foundEpicId = walkToEpic(issue, issueMap)
      if (foundEpicId) {
        let g = groupMap.get(foundEpicId)
        if (!g) {
          const epic = issueMap.get(foundEpicId) ?? null
          g = { key: foundEpicId, epic, children: [] }
          groupMap.set(foundEpicId, g)
        }
        g.children.push(issue)
      } else {
        if (!groupMap.has(NO_EPIC_KEY)) {
          groupMap.set(NO_EPIC_KEY, { key: NO_EPIC_KEY, epic: null, children: [] })
        }
        groupMap.get(NO_EPIC_KEY)!.children.push(issue)
      }
    }

    return [...groupMap.values()]
      .filter((g) => g.epic || g.children.length > 0)
      .sort((a, b) => {
        if (a.key === NO_EPIC_KEY) return 1
        if (b.key === NO_EPIC_KEY) return -1
        return (a.epic ? new Date(a.epic.createdAt).getTime() : 0) - (b.epic ? new Date(b.epic.createdAt).getTime() : 0)
      })
      .map((g) => ({
        ...g,
        children: [...g.children].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }))
  }, [filteredIssues, issueMap, groupBy])

  const groups = useMemo(() => {
    const grouped = new Map<string, Issue[]>()
    if (groupBy === 'epic') return grouped

    if (groupBy === 'type') {
      for (const t of TYPE_ORDER) grouped.set(t, [])
      for (const issue of filteredIssues) {
        const list = grouped.get(issue.type) || []
        list.push(issue)
        grouped.set(issue.type, list)
      }
    } else {
      for (const issue of filteredIssues) {
        const key = issue.assignee?.name || 'Unassigned'
        const list = grouped.get(key) || []
        list.push(issue)
        grouped.set(key, list)
      }
      // Float "Unassigned" to the end so real people read first.
      if (grouped.has('Unassigned')) {
        const u = grouped.get('Unassigned')!
        grouped.delete('Unassigned')
        grouped.set('Unassigned', u)
      }
    }

    for (const [key, items] of grouped) {
      if (items.length === 0) grouped.delete(key)
    }
    return grouped
  }, [filteredIssues, groupBy])

  return { epicGroups, groups }
}

function walkToEpic(start: Issue, issueMap: Map<string, Issue>): string | null {
  const seen = new Set<string>()
  let cur: Issue | undefined = start
  while (cur && cur.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId)
    const parent = issueMap.get(cur.parentId)
    if (!parent) return null
    if (parent.type === 'EPIC') return parent.id
    cur = parent
  }
  return null
}
