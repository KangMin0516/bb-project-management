import { useState } from 'react'
import { Plus, Link2 } from 'lucide-react'
import type { IssueLink } from '@/features/issue/api'
import { useLinkedIssuesDisplay } from '@/features/issue/hooks/useLinkedIssuesDisplay'
import { useIssueLinkMutations } from '@/features/issue/hooks/useIssueLinkMutations'
import { getLinkTypeLabel } from '@/features/issue/lib/linkType'
import LinkedIssueRow from './LinkedIssueRow'
import LinkIssueModal from './LinkIssueModal'

interface LinkedIssuesSectionProps {
  projectId: string
  issueId: string
  sourceLinks: IssueLink[] | undefined
  targetLinks: IssueLink[] | undefined
}

/**
 * "Issues this issue is linked to" — outbound source links plus inbound
 * target links (flipped via the strategy table so the perspective stays
 * consistent). Grouped by the resolved link type.
 */
export default function LinkedIssuesSection({ projectId, issueId, sourceLinks, targetLinks }: LinkedIssuesSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const { all, grouped } = useLinkedIssuesDisplay(sourceLinks, targetLinks)
  const { remove } = useIssueLinkMutations(projectId, issueId)
  const totalLinks = all.length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <Link2 className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Linked Issues {totalLinks > 0 && `(${totalLinks})`}
        </span>
        <AddButton onClick={() => setShowModal(true)} label="Add Link" />
      </div>

      {totalLinks > 0 ? (
        <div className="space-y-2">
          {[...grouped.entries()].map(([type, items]) => (
            <div key={type}>
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {getLinkTypeLabel(type)}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {items.map((item) => (
                  <LinkedIssueRow key={item.linkId} link={item} onRemove={() => remove.mutate(item.linkId)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No linked issues</p>
      )}

      {showModal && (
        <LinkIssueModal projectId={projectId} issueId={issueId} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
