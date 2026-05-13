import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText } from 'lucide-react'
import { specApi, type SpecListItem } from '@/features/specification/api'
import { SPEC_STATUS_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import { useSpecLinkMutations } from '@/features/issue/hooks/useSpecLinkMutations'
import ModalShell from './ModalShell'

interface LinkSpecModalProps {
  projectId: string
  issueId: string
  onClose: () => void
}

/**
 * Two-step picker: choose a spec, then optionally a section within it.
 * Section data is fetched lazily once a spec is selected so we don't pay
 * for fetches the user never opens.
 */
export default function LinkSpecModal({ projectId, issueId, onClose }: LinkSpecModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSpec, setSelectedSpec] = useState<SpecListItem | null>(null)

  const { data: specs } = useQuery({
    queryKey: ['specifications', projectId],
    queryFn: () => specApi.list(projectId),
  })

  const { data: specDetail } = useQuery({
    queryKey: ['specification', projectId, selectedSpec?.id],
    queryFn: () => specApi.get(projectId, selectedSpec!.id),
    enabled: !!selectedSpec,
  })

  const { create } = useSpecLinkMutations(projectId, issueId, onClose)

  const filtered = useMemo(() => {
    if (!specs) return []
    if (!searchQuery) return specs
    const q = searchQuery.toLowerCase()
    return specs.filter((s) => s.title.toLowerCase().includes(q) || (s.category && s.category.toLowerCase().includes(q)))
  }, [specs, searchQuery])

  return (
    <ModalShell
      title={selectedSpec ? 'Select Section' : 'Link Specification'}
      subtitle={selectedSpec?.title}
      onClose={onClose}
      onBack={selectedSpec ? () => setSelectedSpec(null) : undefined}
    >
      {!selectedSpec ? (
        <SpecPicker
          specs={filtered}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onPick={setSelectedSpec}
        />
      ) : (
        <SectionPicker
          spec={selectedSpec}
          sections={specDetail?.sections}
          isPending={create.isPending}
          onPick={(sectionSlug) => create.mutate({ specId: selectedSpec.id, sectionSlug })}
        />
      )}
    </ModalShell>
  )
}

function SpecPicker({
  specs,
  searchQuery,
  onSearchChange,
  onPick,
}: {
  specs: SpecListItem[]
  searchQuery: string
  onSearchChange: (q: string) => void
  onPick: (spec: SpecListItem) => void
}) {
  return (
    <>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title or category..."
          className="w-full rounded border border-gray-300 dark:border-gray-600 pl-7 pr-2 py-1.5 text-sm"
          autoFocus
        />
      </div>
      <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
        {specs.length > 0 ? (
          specs.map((spec) => (
            <button
              key={spec.id}
              onClick={() => onPick(spec)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-900 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{spec.title}</span>
              {spec.category && (
                <span className="rounded bg-gray-200 dark:bg-gray-600 px-1 py-0.5 text-[9px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
                  {spec.category}
                </span>
              )}
              <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium shrink-0', SPEC_STATUS_COLORS[spec.status] || '')}>
                {spec.status}
              </span>
            </button>
          ))
        ) : (
          <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
            {searchQuery ? 'No matching specs' : 'No specifications available'}
          </div>
        )}
      </div>
    </>
  )
}

function SectionPicker({
  spec,
  sections,
  isPending,
  onPick,
}: {
  spec: SpecListItem
  sections: { id: string; sectionId: string; level: number; title: string }[] | undefined
  isPending: boolean
  onPick: (sectionSlug?: string) => void
}) {
  return (
    <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
      <button
        onClick={() => onPick()}
        disabled={isPending}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-900 border-b border-gray-100 dark:border-gray-700 transition-colors disabled:opacity-50 font-medium"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary-500" />
        <span className="text-gray-700 dark:text-gray-300">Entire specification</span>
      </button>
      {sections?.map((sec) => (
        <button
          key={sec.id}
          onClick={() => onPick(sec.sectionId)}
          disabled={isPending}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-900 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors disabled:opacity-50"
          style={{ paddingLeft: `${(sec.level - 1) * 12 + 12}px` }}
        >
          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">§</span>
          <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{sec.title}</span>
        </button>
      ))}
      {!sections && (
        <div className="px-3 py-4 text-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent mx-auto" />
        </div>
      )}
      {/* spec parameter only used for type narrowing — UI text shown via parent subtitle */}
      <span className="hidden">{spec.title}</span>
    </div>
  )
}
