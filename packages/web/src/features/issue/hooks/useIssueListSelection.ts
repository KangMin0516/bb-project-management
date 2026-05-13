import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Issue } from '@/features/issue/api'
import { useRegisterShortcuts } from '@/shared/lib/useRegisterShortcuts'

interface UseIssueListSelectionOptions {
  items: Issue[]
  onOpen: (issue: Issue) => void
  isDetailOpen: boolean
}

/**
 * Bulk selection + j/k/Enter/x keyboard nav for the issues table. The
 * focused row is scrolled into view automatically so navigation works
 * even when the table extends past the viewport.
 */
export function useIssueListSelection({ items, onOpen, isDetailOpen }: UseIssueListSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)
  const tableRef = useRef<HTMLTableSectionElement>(null)

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => (prev.size === items.length && items.length > 0 ? new Set() : new Set(items.map((i) => i.id))))
  }, [items])

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  useEffect(() => {
    if (focusedRowIndex >= 0 && tableRef.current) {
      const row = tableRef.current.children[focusedRowIndex] as HTMLElement | undefined
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedRowIndex])

  const shortcuts = useMemo(() => [
    {
      id: 'issues-next', keys: 'j', label: 'Next issue', category: 'Issues' as const,
      handler: () => setFocusedRowIndex((p) => Math.min(p + 1, items.length - 1)),
    },
    {
      id: 'issues-prev', keys: 'k', label: 'Previous issue', category: 'Issues' as const,
      handler: () => setFocusedRowIndex((p) => Math.max(p <= 0 ? 0 : p - 1, 0)),
    },
    {
      id: 'issues-open', keys: 'enter', label: 'Open issue detail', category: 'Issues' as const,
      handler: () => {
        const issue = items[focusedRowIndex]
        if (issue) onOpen(issue)
      },
      when: () => !isDetailOpen,
    },
    {
      id: 'issues-toggle-select', keys: 'x', label: 'Toggle select', category: 'Issues' as const,
      handler: () => {
        const issue = items[focusedRowIndex]
        if (issue) toggleOne(issue.id)
      },
    },
  ], [items, focusedRowIndex, isDetailOpen, onOpen, toggleOne])

  useRegisterShortcuts('issues', shortcuts)

  return { selectedIds, focusedRowIndex, tableRef, toggleAll, toggleOne, clear }
}
