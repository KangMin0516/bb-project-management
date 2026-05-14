import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Issue } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'

export function useOpenIssueFromUrl(
  issues: Issue[] | undefined,
  onSelect: (issue: Issue) => void,
  options?: { showNotFound?: boolean },
) {
  const [searchParams, setSearchParams] = useSearchParams()

  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })

  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || !issues) return

    const issue = issues.find((i) => i.id === openId)
    if (issue) {
      onSelectRef.current(issue)
    } else if (options?.showNotFound) {
      useToastStore.getState().addToast('Issue not found on this page', 'error')
    }
    setSearchParams((prev) => {
      prev.delete('open')
      return prev
    }, { replace: true })
  }, [issues, searchParams, setSearchParams, options?.showNotFound])
}
