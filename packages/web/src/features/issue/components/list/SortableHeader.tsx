import { ChevronUp, ChevronDown } from 'lucide-react'
import type { SortField, SortOrder } from '@/features/issue/hooks/useIssueListUrlState'

interface SortableHeaderProps {
  label: string
  field: SortField
  sortBy: SortField | ''
  sortOrder: SortOrder
  onToggle: (field: SortField) => void
}

/**
 * Column header that drives the table sort. Inactive headers show the
 * sort affordance on hover; active headers show the resolved direction.
 */
export default function SortableHeader({ label, field, sortBy, sortOrder, onToggle }: SortableHeaderProps) {
  const isActive = sortBy === field
  const Icon = isActive ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : ChevronDown
  return (
    <th className="group cursor-pointer px-3 py-2" onClick={() => onToggle(field)}>
      {label}{' '}
      <Icon
        className={
          isActive
            ? 'ml-0.5 inline h-3 w-3 text-primary-600'
            : 'ml-0.5 inline h-3 w-3 opacity-0 group-hover:opacity-40'
        }
      />
    </th>
  )
}
