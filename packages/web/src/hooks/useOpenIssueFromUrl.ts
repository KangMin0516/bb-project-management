import { useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Issue } from '@/api/issues'
import { useToastStore } from '@/stores/toast'

export function useOpenIssueFromUrl(
  issues: Issue[] | undefined,
  onSelect: (issue: Issue) => void,
  options?: { showNotFound?: boolean },
) {
  const [searchParams, setSearchParams] = useSearchParams()

  const stableOnSelect = useCallback(onSelect, [])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || !issues) return

    const issue = issues.find((i) => i.id === openId)
    if (issue) {
      stableOnSelect(issue)
    } else if (options?.showNotFound) {
      useToastStore.getState().addToast('Issue not found on this page', 'warning')
    }
    setSearchParams({}, { replace: true })
  }, [issues, searchParams, setSearchParams, stableOnSelect, options?.showNotFound])
}
