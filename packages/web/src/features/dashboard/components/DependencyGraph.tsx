import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { type DependencyLink, type LinkedIssueInfo } from '@/features/issue/api'
import { cn } from '@/shared/lib/utils'
import { STATUS_COLORS, PRIORITY_COLORS } from '@/shared/config/constants'
import { AlertTriangle, CheckCircle2, ArrowRight, GitBranch, ChevronDown, ChevronRight } from 'lucide-react'

type FilterMode = 'all' | 'blocked' | 'resolved'

interface DependencyChain {
  /** The blocker (source) issue */
  blocker: LinkedIssueInfo
  /** Issues blocked by this blocker */
  blocked: LinkedIssueInfo[]
}

function buildDependencyData(links: DependencyLink[]) {
  // Group by blocker: blocker BLOCKS -> [blocked issues]
  const blockerMap = new Map<string, DependencyChain>()
  const blockedIssueIds = new Set<string>()

  for (const link of links) {
    const existing = blockerMap.get(link.sourceIssue.id)
    if (existing) {
      existing.blocked.push(link.targetIssue)
    } else {
      blockerMap.set(link.sourceIssue.id, {
        blocker: link.sourceIssue,
        blocked: [link.targetIssue],
      })
    }
    blockedIssueIds.add(link.targetIssue.id)
  }

  const chains = Array.from(blockerMap.values())

  // Sort: unresolved blockers first (blocker not DONE), then by number of blocked issues
  chains.sort((a, b) => {
    const aResolved = a.blocker.status === 'DONE' || a.blocker.status === 'CANCELED'
    const bResolved = b.blocker.status === 'DONE' || b.blocker.status === 'CANCELED'
    if (aResolved !== bResolved) return aResolved ? 1 : -1
    return b.blocked.length - a.blocked.length
  })

  return { chains, blockedIssueIds }
}

function isResolved(status: string) {
  return status === 'DONE' || status === 'CANCELED'
}

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_COLORS[status] || 'bg-gray-400')}
      title={status.replace(/_/g, ' ')}
    />
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
        PRIORITY_COLORS[priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-500',
      )}
    >
      {priority}
    </span>
  )
}

function IssueNode({
  issue,
  isBlocked,
  isBlockerResolved,
  onClick,
}: {
  issue: LinkedIssueInfo
  isBlocked: boolean
  isBlockerResolved?: boolean
  onClick: () => void
}) {
  const resolved = isResolved(issue.status)
  const showWarning = isBlocked && !isBlockerResolved && !resolved

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm',
        showWarning
          ? 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700'
          : resolved
            ? 'border-green-200 dark:border-green-800 bg-green-50/40 dark:bg-green-900/30 hover:border-green-300 dark:hover:border-green-700'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600',
      )}
    >
      <StatusDot status={issue.status} />
      <span className="shrink-0 font-mono text-xs text-gray-400 dark:text-gray-500">
        {issue.project.key}-{issue.number}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-medium group-hover:text-primary-700',
          showWarning ? 'text-red-800 dark:text-red-300' : resolved ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100',
        )}
      >
        {issue.title}
      </span>
      {showWarning && (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
      )}
      {isBlocked && isBlockerResolved && (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
      )}
      <PriorityBadge priority={issue.priority} />
    </button>
  )
}

function DependencyChainRow({
  chain,
  onIssueClick,
}: {
  chain: DependencyChain
  onIssueClick: (issueId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const blockerResolved = isResolved(chain.blocker.status)
  const unresolvedBlockedCount = chain.blocked.filter(
    (b) => !isResolved(b.status),
  ).length

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Blocker header */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            blockerResolved
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
          )}
        >
          {blockerResolved ? 'Resolved' : 'Blocking'}
        </div>

        <div className="min-w-0 flex-1">
          <IssueNode
            issue={chain.blocker}
            isBlocked={false}
            onClick={() => onIssueClick(chain.blocker.id)}
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <ArrowRight className="h-3 w-3" />
          <span>
            blocks {chain.blocked.length} issue{chain.blocked.length !== 1 ? 's' : ''}
          </span>
          {!blockerResolved && unresolvedBlockedCount > 0 && (
            <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
              {unresolvedBlockedCount} waiting
            </span>
          )}
        </div>
      </div>

      {/* Blocked issues */}
      {expanded && (
        <div className="space-y-1 px-4 py-3">
          {chain.blocked.map((blocked) => (
            <div key={blocked.id} className="flex items-center gap-2">
              {/* Connector line */}
              <div className="flex w-8 items-center justify-center">
                <div className="flex items-center gap-0.5">
                  <div
                    className={cn(
                      'h-px w-4',
                      blockerResolved ? 'bg-green-300' : 'bg-red-300',
                    )}
                  />
                  <ArrowRight
                    className={cn(
                      'h-3 w-3',
                      blockerResolved ? 'text-green-400' : 'text-red-400',
                    )}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <IssueNode
                  issue={blocked}
                  isBlocked={true}
                  isBlockerResolved={blockerResolved}
                  onClick={() => onIssueClick(blocked.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DependencyGraph() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const { data: links, isLoading } = useQuery({
    queryKey: ['dependencies', projectId],
    queryFn: () => issueRepository.findDependencyGraph(projectId!),
    enabled: !!projectId,
  })

  const { chains, blockedIssueIds } = useMemo(
    () => buildDependencyData(links ?? []),
    [links],
  )

  const filteredChains = useMemo(() => {
    if (filterMode === 'all') return chains
    if (filterMode === 'blocked') {
      return chains.filter((c) => !isResolved(c.blocker.status))
    }
    return chains.filter((c) => isResolved(c.blocker.status))
  }, [chains, filterMode])

  const stats = useMemo(() => {
    const totalBlockers = chains.length
    const unresolvedBlockers = chains.filter((c) => !isResolved(c.blocker.status)).length
    const resolvedBlockers = totalBlockers - unresolvedBlockers
    const totalBlocked = blockedIssueIds.size
    return { totalBlockers, unresolvedBlockers, resolvedBlockers, totalBlocked }
  }, [chains, blockedIssueIds])

  const handleIssueClick = (issueId: string) => {
    navigate(`/projects/${projectId}/board?open=${issueId}`)
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!links || links.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
        <GitBranch className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No dependencies found</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Link issues with "Blocks" / "Is blocked by" to see the dependency graph
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
          <GitBranch className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-500">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.totalBlockers}</span> blocking chain{stats.totalBlockers !== 1 ? 's' : ''}
          </span>
        </div>
        {stats.unresolvedBlockers > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-400">
              <span className="font-semibold">{stats.unresolvedBlockers}</span> active blocker{stats.unresolvedBlockers !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {stats.resolvedBlockers > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-400">
              <span className="font-semibold">{stats.resolvedBlockers}</span> resolved
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
          <span className="text-sm text-gray-600 dark:text-gray-500">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.totalBlocked}</span> blocked issue{stats.totalBlocked !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 w-fit">
        {([
          ['all', 'All'],
          ['blocked', 'Active Blockers'],
          ['resolved', 'Resolved'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterMode(key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              filterMode === key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
            )}
          >
            {label}
            {key === 'blocked' && stats.unresolvedBlockers > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400">
                {stats.unresolvedBlockers}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Dependency chains */}
      <div className="space-y-3">
        {filteredChains.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No {filterMode === 'blocked' ? 'active blockers' : 'resolved dependencies'} found
            </p>
          </div>
        ) : (
          filteredChains.map((chain) => (
            <DependencyChainRow
              key={chain.blocker.id}
              chain={chain}
              onIssueClick={handleIssueClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
