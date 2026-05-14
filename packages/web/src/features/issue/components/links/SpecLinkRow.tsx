import { X, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { IssueSpecLink } from '@/features/issue/api'
import { SPEC_STATUS_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'

interface SpecLinkRowProps {
  link: IssueSpecLink
  projectId: string
  onRemove: () => void
}

export default function SpecLinkRow({ link, projectId, onRemove }: SpecLinkRowProps) {
  const navigate = useNavigate()

  const goToSpec = () => {
    const params = new URLSearchParams({ specId: link.spec.id })
    if (link.sectionSlug) params.set('section', link.sectionSlug)
    navigate(`/projects/${projectId}/specs?${params}`)
  }

  return (
    <div className="flex items-center gap-2 rounded bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-sm group">
      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
      <button
        onClick={goToSpec}
        className="flex-1 truncate text-gray-700 dark:text-gray-300 text-xs text-left hover:text-primary-600 transition-colors"
      >
        {link.spec.title}
        {link.sectionSlug && <span className="ml-1 text-gray-400 dark:text-gray-500">§ {link.sectionSlug}</span>}
      </button>
      {link.spec.category && (
        <span className="rounded bg-gray-200 dark:bg-gray-600 px-1 py-0.5 text-[9px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
          {link.spec.category}
        </span>
      )}
      <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium shrink-0', SPEC_STATUS_COLORS[link.spec.status] || '')}>
        {link.spec.status}
      </span>
      <button
        onClick={onRemove}
        className="inline-flex items-center gap-0.5 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
        title="Remove spec link"
      >
        <X className="h-3 w-3" />
        Remove
      </button>
    </div>
  )
}
