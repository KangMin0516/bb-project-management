import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import type { SpecItem } from '@/features/specification/api'
import { specRepository } from '@/features/specification/repository'
import { issueRepository } from '@/features/issue/repository'
import { STATUS_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

interface LinkIssueToItemModalProps {
  projectId: string
  projectKey: string | undefined
  specId: string
  item: SpecItem
  onClose: () => void
}

/**
 * Quick-search modal: fetch all non-archived issues in the project, filter
 * client-side by free text (matches "#42", title, or partial). Wires
 * selection to `specRepository.linkIssueToItem`.
 */
export default function LinkIssueToItemModal({
  projectId,
  projectKey,
  specId,
  item,
  onClose,
}: LinkIssueToItemModalProps) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')

  const issuesQuery = useQuery({
    queryKey: ['issues-search', projectId],
    queryFn: () => issueRepository.findInProject(projectId, { limit: 200 }),
    staleTime: 30_000,
  })

  const linkedIds = useMemo(
    () => new Set(item.issueLinks.map((l) => l.issue.id)),
    [item.issueLinks],
  )

  const filtered = useMemo(() => {
    const items = issuesQuery.data?.items ?? []
    if (!query.trim()) return items.slice(0, 50)
    const q = query.toLowerCase().replace(/^#/, '')
    return items.filter((i) => {
      if (String(i.number) === q) return true
      return (
        i.title.toLowerCase().includes(q) ||
        `#${i.number}`.includes(q) ||
        `${projectKey ?? ''}-${i.number}`.toLowerCase().includes(q)
      )
    }).slice(0, 50)
  }, [issuesQuery.data, query, projectKey])

  const linkMutation = useMutation({
    mutationFn: (issueId: string) => specRepository.linkIssueToItem(projectId, specId, item.id, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specification', projectId, specId] })
      useToastStore.getState().addToast('Issue linked', 'success')
      onClose()
    },
    onError: (err: unknown) =>
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to link issue'), 'error'),
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24">
      <div className="w-[520px] max-w-[90vw] rounded-lg bg-white dark:bg-gray-800 shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-gray-200 dark:border-gray-700 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Link issue to item
            </p>
            <p className="mt-0.5 truncate text-sm text-gray-800 dark:text-gray-200">
              {item.text}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-gray-200 dark:border-gray-700 p-3">
          <label className="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-900 px-2.5 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${projectKey ? `${projectKey}-…` : 'issues'} or title`}
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {issuesQuery.isLoading ? (
            <p className="p-4 text-center text-xs text-gray-400">Loading issues…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-gray-400">No matching issues.</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((issue) => {
                const alreadyLinked = linkedIds.has(issue.id)
                return (
                  <li key={issue.id}>
                    <button
                      type="button"
                      disabled={alreadyLinked || linkMutation.isPending}
                      onClick={() => linkMutation.mutate(issue.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                        alreadyLinked
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700',
                      )}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          STATUS_COLORS[issue.status],
                        )}
                      />
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        {projectKey ?? '#'}-{issue.number}
                      </span>
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-200">
                        {issue.title}
                      </span>
                      {alreadyLinked && (
                        <span className="text-[10px] text-gray-400">Linked</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
