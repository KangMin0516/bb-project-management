import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link as LinkIcon, Plus, Trash2 } from 'lucide-react'
import type { SpecItem } from '@/features/specification/api'
import { specRepository } from '@/features/specification/repository'
import {
  ITEM_STATUS_DOT_CLASS,
  ITEM_STATUS_LABEL,
  rollupItemStatus,
  type SpecItemRollupStatus,
} from '@/features/specification/lib/itemStatus'
import { STATUS_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

interface SpecItemPanelProps {
  projectId: string
  specId: string
  items: SpecItem[]
  filter: SpecItemRollupStatus | 'ALL'
  onFilterChange: (next: SpecItemRollupStatus | 'ALL') => void
  onLinkExistingIssue: (item: SpecItem) => void
  onCreateIssueFromItem: (item: SpecItem) => void
  onIssueClick?: (issueId: string) => void
}

const FILTER_OPTIONS: { value: SpecItemRollupStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DONE', label: 'Done' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'UNPLANNED', label: 'Unplanned' },
]

/**
 * Right-hand panel listing every (non-archived) SpecItem and its linked
 * issues. Status badge is computed client-side (lowest-progress wins);
 * row clicks deep-link into the issue detail panel.
 */
export default function SpecItemPanel({
  projectId,
  specId,
  items,
  filter,
  onFilterChange,
  onLinkExistingIssue,
  onCreateIssueFromItem,
  onIssueClick,
}: SpecItemPanelProps) {
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const unlinkMutation = useMutation({
    mutationFn: ({ itemId, linkId }: { itemId: string; linkId: string }) =>
      specRepository.unlinkIssueFromItem(projectId, specId, itemId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specification', projectId, specId] })
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to unlink issue'), 'error')
    },
  })

  const visibleItems = useMemo(() => {
    const active = items.filter((i) => !i.archivedAt)
    if (filter === 'ALL') return active
    return active.filter((i) => rollupItemStatus(i) === filter)
  }, [items, filter])

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <header className="border-b border-gray-200 dark:border-gray-700 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Items
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition',
                filter === opt.value
                  ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleItems.length === 0 ? (
          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
            No items match this filter.
          </p>
        ) : (
          visibleItems.map((item) => {
            const status = rollupItemStatus(item)
            return (
              <div
                key={item.id}
                className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-1 h-2 w-2 shrink-0 rounded-full',
                      ITEM_STATUS_DOT_CLASS[status],
                    )}
                    title={ITEM_STATUS_LABEL[status]}
                  />
                  <p className="flex-1 text-xs text-gray-800 dark:text-gray-200">{item.text}</p>
                </div>

                {item.issueLinks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.issueLinks.map((link) => (
                      <li key={link.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onIssueClick?.(link.issue.id)}
                          className="flex flex-1 items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-gray-50 dark:hover:bg-gray-700"
                          title={link.issue.title}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              STATUS_COLORS[link.issue.status],
                            )}
                          />
                          <span className="font-mono text-gray-400 dark:text-gray-500">
                            #{link.issue.number}
                          </span>
                          <span className="truncate text-gray-700 dark:text-gray-300">
                            {link.issue.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (pendingDelete === link.id) {
                              unlinkMutation.mutate({ itemId: item.id, linkId: link.id })
                              setPendingDelete(null)
                            } else {
                              setPendingDelete(link.id)
                              setTimeout(() => setPendingDelete((prev) => (prev === link.id ? null : prev)), 2000)
                            }
                          }}
                          className={cn(
                            'shrink-0 rounded p-0.5 transition',
                            pendingDelete === link.id
                              ? 'text-red-600 bg-red-50 dark:bg-red-900/30'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30',
                          )}
                          title={pendingDelete === link.id ? 'Click again to confirm' : 'Unlink'}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => onLinkExistingIssue(item)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateIssueFromItem(item)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Plus className="h-3 w-3" />
                    New issue
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
