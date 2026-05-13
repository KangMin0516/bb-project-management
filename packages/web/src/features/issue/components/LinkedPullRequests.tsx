import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { githubApi, type GitHubPrLink } from '@/features/integrations/github/api'
import { cn } from '@/shared/lib/utils'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { timeAgo } from '@/shared/lib/time'
import { GitMerge, GitPullRequest, X, Plus, ExternalLink } from 'lucide-react'

const STATE_STYLES: Record<string, { bg: string; text: string; icon: typeof GitMerge }> = {
  merged: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-400', icon: GitMerge },
  open: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-400', icon: GitPullRequest },
  closed: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400', icon: GitPullRequest },
}

export default function LinkedPullRequests({
  projectId,
  issueId,
  prLinks: initialPrLinks,
}: {
  projectId: string
  issueId: string
  prLinks?: GitHubPrLink[]
}) {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => githubApi.unlinkPr(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-prs', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to unlink PR'))
    },
  })

  const links = initialPrLinks || []

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <GitPullRequest className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Pull Requests {links.length > 0 && `(${links.length})`}
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Link PR
        </button>
      </div>

      {links.length > 0 ? (
        <div className="space-y-1">
          {links.map((link) => {
            const pr = link.pullRequest
            const style = STATE_STYLES[pr.state] || STATE_STYLES.closed
            const Icon = style.icon
            return (
              <div
                key={link.id}
                className="flex items-start gap-2 rounded bg-gray-50 dark:bg-gray-900 px-2 py-2 text-sm group"
              >
                <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0', style.bg, style.text)}>
                  <Icon className="h-3 w-3" />
                  {pr.state}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                      #{pr.number}
                    </span>
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">{pr.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                    <span>{pr.repoFullName}</span>
                    <span>&middot;</span>
                    <span>{pr.headBranch}</span>
                    <span>&middot;</span>
                    <span>by @{pr.authorLogin}</span>
                    {pr.mergedAt && (
                      <>
                        <span>&middot;</span>
                        <span>merged {timeAgo(pr.mergedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Open in GitHub"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => unlinkMutation.mutate(link.id)}
                  className="inline-flex items-center shrink-0 rounded border border-transparent p-1 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all"
                  title="Unlink PR"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No linked pull requests</p>
      )}

      {showModal && (
        <LinkPrModal
          projectId={projectId}
          issueId={issueId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function LinkPrModal({
  projectId,
  issueId,
  onClose,
}: {
  projectId: string
  issueId: string
  onClose: () => void
}) {
  const [prUrl, setPrUrl] = useState('')
  const queryClient = useQueryClient()

  const linkMutation = useMutation({
    mutationFn: () => githubApi.linkPr({ projectId, issueId, prUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-prs', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      onClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to link PR'))
    },
  })

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Link Pull Request</h3>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              GitHub PR URL
            </label>
            <input
              type="url"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && prUrl.trim()) linkMutation.mutate()
                if (e.key === 'Escape') onClose()
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => linkMutation.mutate()}
              disabled={!prUrl.trim() || linkMutation.isPending}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {linkMutation.isPending ? 'Linking...' : 'Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
