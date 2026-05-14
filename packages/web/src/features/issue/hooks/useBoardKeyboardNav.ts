import { useCallback, useMemo, useState } from 'react'
import type { Issue } from '@/features/issue/api'
import { useRegisterShortcuts } from '@/shared/lib/useRegisterShortcuts'

interface UseBoardKeyboardNavOptions {
  flatBoardIssues: Issue[]
  onOpenIssue: (issue: Issue) => void
  isDetailOpen: boolean
}

/** j / k / Enter navigation across the flat list of visible issues. */
export function useBoardKeyboardNav({ flatBoardIssues, onOpenIssue, isDetailOpen }: UseBoardKeyboardNavOptions) {
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null)

  const step = useCallback((direction: 1 | -1) => {
    setFocusedIssueId((prev) => {
      if (!prev || flatBoardIssues.length === 0) return flatBoardIssues[0]?.id ?? null
      const idx = flatBoardIssues.findIndex((i) => i.id === prev)
      const next = direction === 1
        ? Math.min(idx + 1, flatBoardIssues.length - 1)
        : Math.max(idx - 1, 0)
      return flatBoardIssues[next]?.id ?? null
    })
  }, [flatBoardIssues])

  const shortcuts = useMemo(() => [
    { id: 'board-next', keys: 'j', label: 'Next issue', category: 'Board' as const, handler: () => step(1) },
    { id: 'board-prev', keys: 'k', label: 'Previous issue', category: 'Board' as const, handler: () => step(-1) },
    {
      id: 'board-open',
      keys: 'enter',
      label: 'Open issue detail',
      category: 'Board' as const,
      handler: () => {
        if (!focusedIssueId) return
        const issue = flatBoardIssues.find((i) => i.id === focusedIssueId)
        if (issue) onOpenIssue(issue)
      },
      when: () => !isDetailOpen,
    },
  ], [step, focusedIssueId, flatBoardIssues, onOpenIssue, isDetailOpen])

  useRegisterShortcuts('board', shortcuts)

  return { focusedIssueId }
}
