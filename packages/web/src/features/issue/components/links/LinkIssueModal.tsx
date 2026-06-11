import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { type Issue, type IssueLinkType } from '@/features/issue/api'
import { STATUS_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue'
import PriorityBadge from '@/features/issue/components/badges/PriorityBadge'
import { LINK_TYPES, getLinkTypeLabel } from '@/features/issue/lib/linkType'
import { useIssueLinkMutations } from '@/features/issue/hooks/useIssueLinkMutations'
import ModalShell from './ModalShell'
import { issueRepository } from '@/features/issue/repository'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

interface LinkIssueModalProps {
  projectId: string
  issueId: string
  onClose: () => void
}

/** Pick a link type + target issue from the project's open issues. */
export default function LinkIssueModal({ projectId, issueId, onClose }: LinkIssueModalProps) {
  const [linkType, setLinkType] = useState<IssueLinkType>('RELATES_TO')
  const [searchQuery, setSearchQuery] = useState('')
  // PM-110: search the whole project server-side (matches title / number /
  // KEY-number) instead of fetching the first 200 issues and filtering in
  // memory — on large projects the target issue was never in that window.
  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 250)

  const { data: issuesData, isFetching } = useQuery({
    queryKey: ['issues', projectId, 'link-picker', debouncedQuery],
    queryFn: () => issueRepository.findInProject(projectId, { search: debouncedQuery, limit: 25 }),
  })

  const { create } = useIssueLinkMutations(projectId, issueId, onClose)

  const filteredIssues = useMemo(
    () => (issuesData?.items ?? []).filter((issue: Issue) => issue.id !== issueId),
    [issuesData, issueId],
  )

  return (
    <ModalShell title="Link Issue" onClose={onClose}>
      <Field label="Link Type">
        <Select value={linkType} onValueChange={(v) => setLinkType(v as IssueLinkType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{getLinkTypeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Search Issues">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or number..."
            className="w-full rounded border border-gray-300 dark:border-gray-600 pl-7 pr-2 py-1.5 text-sm"
            autoFocus
          />
        </div>
      </Field>

      <div className="max-h-60 w-full overflow-y-auto overflow-x-hidden border border-gray-200 dark:border-gray-700 rounded">
        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue: Issue) => (
            <IssueOption
              key={issue.id}
              issue={issue}
              disabled={create.isPending}
              onClick={() => create.mutate({ targetIssueId: issue.id, type: linkType })}
            />
          ))
        ) : (
          <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
            {isFetching ? 'Searching…' : debouncedQuery ? 'No matching issues' : 'No issues available'}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function IssueOption({ issue, disabled, onClick }: { issue: Issue; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-900 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors disabled:opacity-50"
    >
      <div className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLORS[issue.status])} />
      <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0">#{issue.number}</span>
      <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{issue.title}</span>
      <PriorityBadge priority={issue.priority} className="text-[9px] shrink-0" />
    </button>
  )
}
