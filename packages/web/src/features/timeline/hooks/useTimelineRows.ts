import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import { NO_EPIC_KEY, type EpicGroup, type GroupBy, type TimelineRow } from '@/features/timeline/lib'

/**
 * Flattens the groupings into the linear row list the renderer iterates
 * over. EPIC rows can be collapsed; collapsing hides the row's children
 * but keeps the EPIC visible (so users can re-expand it).
 */
export function useTimelineRows(
  groupBy: GroupBy,
  epicGroups: EpicGroup[],
  groups: Map<string, Issue[]>,
  collapsedEpics: Set<string>,
): TimelineRow[] {
  return useMemo(() => {
    const rows: TimelineRow[] = []
    if (groupBy === 'epic') {
      for (const g of epicGroups) {
        const collapseKey = g.epic ? g.epic.id : NO_EPIC_KEY
        const collapsed = collapsedEpics.has(collapseKey)
        if (g.epic) {
          rows.push({ kind: 'epic', epic: g.epic, childCount: g.children.length, collapsed })
        } else {
          rows.push({ kind: 'no-epic', childCount: g.children.length, collapsed })
        }
        if (!collapsed) {
          for (const issue of g.children) rows.push({ kind: 'issue', issue, indent: 1 })
        }
      }
    } else {
      for (const [label, items] of groups) {
        rows.push({ kind: 'group', label, count: items.length })
        for (const issue of items) rows.push({ kind: 'issue', issue, indent: 0 })
      }
    }
    return rows
  }, [groupBy, epicGroups, groups, collapsedEpics])
}
