import type { Ref } from 'react'
import type { Issue } from '@/features/issue/api'
import type { SortField, SortOrder } from '@/features/issue/hooks/useIssueListUrlState'
import IssueRow from './IssueRow'
import SortableHeader from './SortableHeader'

interface IssuesTableProps {
  items: Issue[]
  projectKey: string
  selectedIds: Set<string>
  focusedRowIndex: number
  tableRef: Ref<HTMLTableSectionElement>
  sortBy: SortField | ''
  sortOrder: SortOrder
  onToggleSort: (field: SortField) => void
  onToggleSelectAll: () => void
  onToggleSelect: (id: string) => void
  onOpen: (issue: Issue) => void
  onDelete: (issueId: string) => void
}

export default function IssuesTable({
  items,
  projectKey,
  selectedIds,
  focusedRowIndex,
  tableRef,
  sortBy,
  sortOrder,
  onToggleSort,
  onToggleSelectAll,
  onToggleSelect,
  onOpen,
  onDelete,
}: IssuesTableProps) {
  const allSelected = items.length > 0 && selectedIds.size === items.length

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
        <tr>
          <th className="w-8 px-3 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
          </th>
          <SortableHeader label="ID" field="number" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
          <th className="px-3 py-2">Title</th>
          <SortableHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
          <SortableHeader label="Priority" field="priority" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Assignee</th>
          <SortableHeader label="Due" field="dueDate" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
          <SortableHeader label="Created" field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onToggle={onToggleSort} />
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody ref={tableRef} className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((issue, rowIndex) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            projectKey={projectKey}
            isSelected={selectedIds.has(issue.id)}
            isFocused={rowIndex === focusedRowIndex}
            onOpen={onOpen}
            onToggleSelect={onToggleSelect}
            onDelete={onDelete}
          />
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={10} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
              No issues found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
