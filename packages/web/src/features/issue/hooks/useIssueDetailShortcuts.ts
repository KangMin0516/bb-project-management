import { useMemo, useRef, useCallback, type RefObject } from 'react'
import { useRegisterShortcuts } from '@/shared/lib/useRegisterShortcuts'

interface UseIssueDetailShortcutsOptions {
  panelRef: RefObject<HTMLElement | null>
  /** When true, all shortcuts are disabled (e.g. while typing). */
  disabled: boolean
}

/**
 * Registers the panel's keyboard shortcuts (a / s / p for assignee /
 * status / priority). Looks up the InlineField trigger button by its
 * `data-field-trigger` attribute and clicks it — that lets us drive the
 * UI without lifting `editing` state out of `InlineField`.
 */
export function useIssueDetailShortcuts({ panelRef, disabled }: UseIssueDetailShortcutsOptions) {
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const triggerField = useCallback((fieldId: string) => {
    const btn = panelRef.current?.querySelector(`[data-field-trigger="${fieldId}"]`) as HTMLButtonElement | null
    btn?.click()
  }, [panelRef])

  const shortcuts = useMemo(() => {
    const enabled = () => !disabledRef.current
    return [
      { id: 'detail-assignee', keys: 'a', label: 'Edit assignee', category: 'Issue Detail' as const, handler: () => triggerField('assignee'), when: enabled },
      { id: 'detail-status',   keys: 's', label: 'Edit status',   category: 'Issue Detail' as const, handler: () => triggerField('status'),   when: enabled },
      { id: 'detail-priority', keys: 'p', label: 'Edit priority', category: 'Issue Detail' as const, handler: () => triggerField('priority'), when: enabled },
    ]
  }, [triggerField])

  useRegisterShortcuts('issue-detail', shortcuts)
}
