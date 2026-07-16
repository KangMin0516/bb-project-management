import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from '@/features/issue/components/board/types'

interface UseBoardDerivationsOptions {
  /**
   * When true, sub-tasks are surfaced as full cards in `parentOnlyBoard`
   * (in addition to staying in `childrenMap` for the per-task expand UI).
   * Wired to the `Sub-tasks` toolbar toggle (PM-70).
   */
  includeSubtasks?: boolean
  members?: { user: { id: string; name: string; avatar: string | null } }[]
}

/**
 * One pass over the raw board produces every secondary structure the
 * page needs: per-id lookup, sub-task index, parent-only filtered view,
 * the assignee/label/component/epic facets shown in the toolbar, and
 * (when `includeSubtasks` is on) the sub-task → epic-ancestor map the
 * swimlane view needs to slot sub-tasks into their epic lane.
 */
export function useBoardDerivations(
  board: Record<string, Issue[]> | undefined,
  options: UseBoardDerivationsOptions = {},
) {
  const includeSubtasks = options.includeSubtasks ?? false
  const members = options.members ?? []
  return useMemo(() => {
    const allIssuesById = new Map<string, Issue>()
    const childrenMap = new Map<string, ChildIssue[]>()
    const parentOnlyBoard: Record<string, Issue[]> = {}
    const assigneeMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const reviewerMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const creatorMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const labelMap = new Map<string, { id: string; name: string; color: string }>()
    const compMap = new Map<string, { id: string; name: string }>()
    const epics: Issue[] = []
    const epicAncestorMap = new Map<string, string | null>()
    const memberById = new Map(
      members.map((m) => [m.user.id, { id: m.user.id, name: m.user.name, avatar: m.user.avatar }]),
    )

    if (!board) {
      return {
        allIssuesById,
        childrenMap,
        parentOnlyBoard: undefined as Record<string, Issue[]> | undefined,
        epicAncestorMap,
        assignedMembers: [] as { id: string; name: string; avatar: string | null }[],
        boardReviewers: [] as { id: string; name: string; avatar: string | null }[],
        boardCreators: [] as { id: string; name: string; avatar: string | null }[],
        boardLabels: [] as { id: string; name: string; color: string }[],
        boardComponents: [] as { id: string; name: string }[],
        boardEpics: epics,
        flatBoardIssues: [] as Issue[],
      }
    }

    for (const [status, issues] of Object.entries(board)) {
      const parents: Issue[] = []
      for (const issue of issues) {
        allIssuesById.set(issue.id, issue)

        // Populate childrenMap for every issue that has a parent, not
        // just SUB_TASKs. Previously EPIC cards rendered "0/N" until the
        // user expanded the chevron — childrenMap was empty for them
        // because TASK/BUG (direct children of EPIC) were skipped, so
        // `doneCount = displayList.filter(DONE).length` was always 0.
        // DOMAIN parents are excluded — they don't render as kanban cards.
        if (issue.parentId && issue.type !== 'DOMAIN') {
          const list = childrenMap.get(issue.parentId) ?? []
          list.push({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            status: issue.status,
            priority: issue.priority,
            assignee: issue.assignee
              ? { id: issue.assignee.id, name: issue.assignee.name, avatar: issue.assignee.avatar }
              : null,
          })
          childrenMap.set(issue.parentId, list)
        }

        if (issue.type === 'SUB_TASK') {
          // When the toggle is on, the sub-task ALSO renders as a full
          // card. We add it to parents here so it lands in the same
          // status column as a peer of its grandparent's tasks.
          if (includeSubtasks) parents.push(issue)
        } else if (issue.type !== 'DOMAIN') {
          // DOMAINs are organisational rows (Modules) and don't belong
          // in the kanban status columns. Keep them in `allIssuesById`
          // so the TOC sidebar can still resolve a Module-row click
          // into a full Issue for the detail panel.
          parents.push(issue)
        }

        if (issue.assignee) assigneeMap.set(issue.assignee.id, issue.assignee)
        if (issue.reviewerAssigneeId) {
          const reviewer = issue.reviewerAssignee ?? memberById.get(issue.reviewerAssigneeId)
          if (reviewer) reviewerMap.set(issue.reviewerAssigneeId, reviewer)
        }
        if (issue.creatorId) {
          const creator = issue.creator ?? memberById.get(issue.creatorId)
          if (creator) creatorMap.set(issue.creatorId, creator)
        }
        for (const il of issue.labels) labelMap.set(il.label.id, il.label)
        for (const ic of issue.components ?? []) compMap.set(ic.component.id, ic.component)
        if (issue.type === 'EPIC') epics.push(issue)
      }
      parentOnlyBoard[status] = parents
    }

    // Walk the parent chain for sub-tasks to find their epic ancestor.
    // Used by `SwimlaneBoardView` to group sub-tasks into the right lane
    // when `includeSubtasks` is on (sub-task.parentId is a TASK, not an
    // EPIC, so the lane logic needs this extra hop).
    if (includeSubtasks) {
      for (const issue of allIssuesById.values()) {
        if (issue.type !== 'SUB_TASK') continue
        let cursor: Issue | undefined = issue
        const seen = new Set<string>()
        while (cursor?.parentId && !seen.has(cursor.parentId)) {
          seen.add(cursor.parentId)
          const parent = allIssuesById.get(cursor.parentId)
          if (!parent) break
          if (parent.type === 'EPIC') {
            epicAncestorMap.set(issue.id, parent.id)
            break
          }
          cursor = parent
        }
        if (!epicAncestorMap.has(issue.id)) epicAncestorMap.set(issue.id, null)
      }
    }

    const flatBoardIssues = Object.values(parentOnlyBoard).flat()

    return {
      allIssuesById,
      childrenMap,
      parentOnlyBoard,
      epicAncestorMap,
      assignedMembers: [...assigneeMap.values()],
      boardReviewers: [...reviewerMap.values()],
      boardCreators: [...creatorMap.values()],
      boardLabels: [...labelMap.values()],
      boardComponents: [...compMap.values()],
      boardEpics: epics,
      flatBoardIssues,
    }
  }, [board, includeSubtasks, members])
}
