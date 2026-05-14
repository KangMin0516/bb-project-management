import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import type { IssueSpecLink } from '@/features/issue/api'
import { useSpecLinkMutations } from '@/features/issue/hooks/useSpecLinkMutations'
import SpecLinkRow from './SpecLinkRow'
import LinkSpecModal from './LinkSpecModal'

interface SpecRefsSectionProps {
  projectId: string
  issueId: string
  specLinks: IssueSpecLink[] | undefined
}

export default function SpecRefsSection({ projectId, issueId, specLinks }: SpecRefsSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const { remove } = useSpecLinkMutations(projectId, issueId)
  const count = specLinks?.length ?? 0

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Spec References {count > 0 && `(${count})`}
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Spec
        </button>
      </div>

      {count > 0 ? (
        <div className="space-y-0.5">
          {specLinks!.map((link) => (
            <SpecLinkRow key={link.id} link={link} projectId={projectId} onRemove={() => remove.mutate(link.id)} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No spec references</p>
      )}

      {showModal && (
        <LinkSpecModal projectId={projectId} issueId={issueId} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
