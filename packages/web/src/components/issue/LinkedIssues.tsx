import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { issueApi, type IssueLink, type IssueLinkType, type IssueSpecLink, type Issue } from '@/api/issues'
import { specApi, type SpecListItem } from '@/api/specifications'
import { STATUS_COLORS, PRIORITY_COLORS, SPEC_STATUS_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { X, Link2, Plus, Search, FileText } from 'lucide-react'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'

const LINK_TYPE_LABELS: Record<IssueLinkType, string> = {
  BLOCKS: 'blocks',
  IS_BLOCKED_BY: 'is blocked by',
  RELATES_TO: 'relates to',
  DUPLICATES: 'duplicates',
  IS_DUPLICATED_BY: 'is duplicated by',
}

const LINK_TYPES: IssueLinkType[] = [
  'BLOCKS',
  'IS_BLOCKED_BY',
  'RELATES_TO',
  'DUPLICATES',
  'IS_DUPLICATED_BY',
]

interface LinkedIssueDisplay {
  linkId: string
  type: IssueLinkType
  issueId: string
  number: number
  title: string
  status: string
  priority: string
  projectKey: string
}

export default function LinkedIssues({
  projectId,
  issueId,
  sourceLinks,
  targetLinks,
  specLinks,
}: {
  projectId: string
  issueId: string
  sourceLinks?: IssueLink[]
  targetLinks?: IssueLink[]
  specLinks?: IssueSpecLink[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [showSpecModal, setShowSpecModal] = useState(false)
  const queryClient = useQueryClient()

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => issueApi.deleteLink(projectId, issueId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete link'))
    },
  })

  const linkedIssues = useMemo<LinkedIssueDisplay[]>(() => {
    const items: LinkedIssueDisplay[] = []

    if (sourceLinks) {
      for (const link of sourceLinks) {
        if (link.targetIssue) {
          items.push({
            linkId: link.id,
            type: link.type,
            issueId: link.targetIssue.id,
            number: link.targetIssue.number,
            title: link.targetIssue.title,
            status: link.targetIssue.status,
            priority: link.targetIssue.priority,
            projectKey: link.targetIssue.project.key,
          })
        }
      }
    }

    return items
  }, [sourceLinks])

  const grouped = useMemo(() => {
    const map = new Map<IssueLinkType, LinkedIssueDisplay[]>()
    for (const item of linkedIssues) {
      const list = map.get(item.type) || []
      list.push(item)
      map.set(item.type, list)
    }
    return map
  }, [linkedIssues])

  const totalLinks = linkedIssues.length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="block text-sm font-medium text-gray-700">
          <Link2 className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Linked Issues {totalLinks > 0 && `(${totalLinks})`}
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Link
        </button>
      </div>

      {totalLinks > 0 ? (
        <div className="space-y-2">
          {[...grouped.entries()].map(([type, items]) => (
            <div key={type}>
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {LINK_TYPE_LABELS[type]}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {items.map((item) => (
                  <div
                    key={item.linkId}
                    className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm group"
                  >
                    <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[item.status])} />
                    <span className="font-mono text-[10px] text-gray-400 shrink-0">
                      {item.projectKey}-{item.number}
                    </span>
                    <span className="flex-1 truncate text-gray-700 text-xs">{item.title}</span>
                    <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium shrink-0', PRIORITY_COLORS[item.priority])}>
                      {item.priority}
                    </span>
                    <button
                      onClick={() => deleteLinkMutation.mutate(item.linkId)}
                      className="inline-flex items-center gap-0.5 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
                      title="Remove link"
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">No linked issues</p>
      )}

      {/* Spec References */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="block text-sm font-medium text-gray-700">
            <FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Spec References {specLinks && specLinks.length > 0 && `(${specLinks.length})`}
          </span>
          <button
            onClick={() => setShowSpecModal(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Spec
          </button>
        </div>

        {specLinks && specLinks.length > 0 ? (
          <div className="space-y-0.5">
            {specLinks.map((link) => (
              <SpecLinkItem key={link.id} link={link} projectId={projectId} issueId={issueId} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No spec references</p>
        )}
      </div>

      {showModal && (
        <LinkIssueModal
          projectId={projectId}
          issueId={issueId}
          onClose={() => setShowModal(false)}
        />
      )}

      {showSpecModal && (
        <LinkSpecModal
          projectId={projectId}
          issueId={issueId}
          onClose={() => setShowSpecModal(false)}
        />
      )}
    </div>
  )
}

function SpecLinkItem({ link, projectId, issueId }: { link: IssueSpecLink; projectId: string; issueId: string }) {
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: () => issueApi.deleteSpecLink(projectId, issueId, link.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to remove spec link'))
    },
  })

  return (
    <div className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm group">
      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="flex-1 truncate text-gray-700 text-xs">{link.spec.title}</span>
      {link.spec.category && (
        <span className="rounded bg-gray-200 px-1 py-0.5 text-[9px] font-medium text-gray-500 shrink-0">
          {link.spec.category}
        </span>
      )}
      <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium shrink-0', SPEC_STATUS_COLORS[link.spec.status] || '')}>
        {link.spec.status}
      </span>
      <button
        onClick={() => deleteMutation.mutate()}
        className="inline-flex items-center gap-0.5 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
        title="Remove spec link"
      >
        <X className="h-3 w-3" />
        Remove
      </button>
    </div>
  )
}

function LinkSpecModal({
  projectId,
  issueId,
  onClose,
}: {
  projectId: string
  issueId: string
  onClose: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: specs } = useQuery({
    queryKey: ['specifications', projectId],
    queryFn: () => specApi.list(projectId),
  })

  const createMutation = useMutation({
    mutationFn: (specId: string) =>
      issueApi.createSpecLink(projectId, issueId, { specId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      onClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to link spec'))
    },
  })

  const filtered = useMemo(() => {
    if (!specs) return []
    if (!searchQuery) return specs
    const q = searchQuery.toLowerCase()
    return specs.filter((s: SpecListItem) =>
      s.title.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q))
    )
  }, [specs, searchQuery])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Link Specification</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or category..."
              className="w-full rounded border border-gray-300 pl-7 pr-2 py-1.5 text-sm"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
            {filtered.length > 0 ? (
              filtered.map((spec: SpecListItem) => (
                <button
                  key={spec.id}
                  onClick={() => createMutation.mutate(spec.id)}
                  disabled={createMutation.isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="flex-1 truncate text-gray-700">{spec.title}</span>
                  {spec.category && (
                    <span className="rounded bg-gray-200 px-1 py-0.5 text-[9px] font-medium text-gray-500 shrink-0">
                      {spec.category}
                    </span>
                  )}
                  <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium shrink-0', SPEC_STATUS_COLORS[spec.status] || '')}>
                    {spec.status}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {searchQuery ? 'No matching specs' : 'No specifications available'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LinkIssueModal({
  projectId,
  issueId,
  onClose,
}: {
  projectId: string
  issueId: string
  onClose: () => void
}) {
  const [linkType, setLinkType] = useState<IssueLinkType>('RELATES_TO')
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId, { limit: '200' }],
    queryFn: () => issueApi.list(projectId, { limit: '200' }),
  })

  const createLinkMutation = useMutation({
    mutationFn: (targetIssueId: string) =>
      issueApi.createLink(projectId, issueId, { targetIssueId, type: linkType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      onClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create link'))
    },
  })

  const filteredIssues = useMemo(() => {
    if (!issuesData?.items) return []
    return issuesData.items.filter((issue: Issue) => {
      if (issue.id === issueId) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        issue.title.toLowerCase().includes(q) ||
        String(issue.number).includes(q)
      )
    })
  }, [issuesData?.items, searchQuery, issueId])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Link Issue</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Link Type
            </label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as IssueLinkType)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LINK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Search Issues
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or number..."
                className="w-full rounded border border-gray-300 pl-7 pr-2 py-1.5 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
            {filteredIssues.length > 0 ? (
              filteredIssues.map((issue: Issue) => (
                <button
                  key={issue.id}
                  onClick={() => createLinkMutation.mutate(issue.id)}
                  disabled={createLinkMutation.isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors disabled:opacity-50"
                >
                  <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
                  <span className="font-mono text-[10px] text-gray-400 shrink-0">
                    #{issue.number}
                  </span>
                  <span className="flex-1 truncate text-gray-700">{issue.title}</span>
                  <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium shrink-0', PRIORITY_COLORS[issue.priority])}>
                    {issue.priority}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {searchQuery ? 'No matching issues' : 'No issues available'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
