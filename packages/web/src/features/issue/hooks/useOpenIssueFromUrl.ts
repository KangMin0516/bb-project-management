import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Issue } from '@/features/issue/api'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'

export function useOpenIssueFromUrl(
  issues: Issue[] | undefined,
  onSelect: (issue: Issue) => void,
  options?: { showNotFound?: boolean; projectId?: string },
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open')
  const projectId = options?.projectId

  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })

  // Prefer a row already on the current page (board / list).
  const fromList = openId && issues ? issues.find((i) => i.id === openId) : undefined

  // Fall back to fetching by id when the issue isn't on this page — e.g. a
  // Slack DM / deep-link to an archived or DONE ticket that aged out of the
  // board payload. Shares the detail panel's ['issue', …] cache, so it's
  // deduped and instant once warm.
  const needsFetch = !!openId && !!projectId && !!issues && !fromList
  const { data: fetched, isError } = useQuery({
    queryKey: ['issue', projectId, openId],
    queryFn: () => issueRepository.findOne(projectId!, openId!),
    enabled: needsFetch,
  })

  useEffect(() => {
    if (!openId || !issues) return
    if (fromList) {
      onSelectRef.current(fromList)
    } else if (!projectId) {
      // No fetch fallback configured — preserve legacy behaviour.
      if (options?.showNotFound) useToastStore.getState().addToast('Issue not found on this page', 'error')
    } else if (fetched) {
      onSelectRef.current(fetched)
    } else if (isError) {
      if (options?.showNotFound) useToastStore.getState().addToast('Issue not found', 'error')
    } else {
      // Fetch still in flight — keep ?open in the URL until it resolves.
      return
    }
    setSearchParams((prev) => {
      prev.delete('open')
      return prev
    }, { replace: true })
  }, [openId, issues, fromList, projectId, fetched, isError, options?.showNotFound, setSearchParams])
}
