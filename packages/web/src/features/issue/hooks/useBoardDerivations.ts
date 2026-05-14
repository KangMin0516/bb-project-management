import { useMemo } from 'react'
import type { Issue } from '@/features/issue/api'
import type { ChildIssue } from '@/features/issue/components/board/types'

/**
 * One pass over the raw board produces every secondary structure the
 * page needs: per-id lookup, sub-task index, parent-only filtered view,
 * and the assignee/label/component/epic facets shown in the toolbar.
 */
export function useBoardDerivations(board: Record<string, Issue[]> | undefined) {
  return useMemo(() => {
    const allIssuesById = new Map<string, Issue>()
    const childrenMap = new Map<string, ChildIssue[]>()
    const parentOnlyBoard: Record<string, Issue[]> = {}
    const assigneeMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    const labelMap = new Map<string, { id: string; name: string; color: string }>()
    const compMap = new Map<string, { id: string; name: string }>()
    const epics: Issue[] = []

    if (!board) {
      return {
        allIssuesById,
        childrenMap,
        parentOnlyBoard: undefined as Record<string, Issue[]> | undefined,
        assignedMembers: [] as { id: string; name: string; avatar: string | null }[],
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

        if (issue.type === 'SUB_TASK' && issue.parentId) {
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
        } else {
          parents.push(issue)
        }

        if (issue.assignee) assigneeMap.set(issue.assignee.id, issue.assignee)
        for (const il of issue.labels) labelMap.set(il.label.id, il.label)
        for (const ic of issue.components ?? []) compMap.set(ic.component.id, ic.component)
        if (issue.type === 'EPIC') epics.push(issue)
      }
      parentOnlyBoard[status] = parents
    }

    const flatBoardIssues = Object.values(parentOnlyBoard).flat()

    return {
      allIssuesById,
      childrenMap,
      parentOnlyBoard,
      assignedMembers: [...assigneeMap.values()],
      boardLabels: [...labelMap.values()],
      boardComponents: [...compMap.values()],
      boardEpics: epics,
      flatBoardIssues,
    }
  }, [board])
}
