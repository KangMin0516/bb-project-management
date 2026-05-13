import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import { STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from '@/shared/config/constants'
import { X, Trash2 } from 'lucide-react'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'

interface BulkActionBarProps {
  projectId: string
  selectedIds: Set<string>
  members: { id: string; name: string }[]
  onClear: () => void
}

export default function BulkActionBar({ projectId, selectedIds, members, onClear }: BulkActionBarProps) {
  const queryClient = useQueryClient()
  const count = selectedIds.size

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    onClear()
  }

  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { status?: string; priority?: string; assigneeId?: string | null }) =>
      issueRepository.bulkUpdate(projectId, { issueIds: [...selectedIds], ...data }),
    onSuccess: () => invalidate(),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Bulk update failed'))
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () => issueRepository.bulkDelete(projectId, [...selectedIds]),
    onSuccess: () => invalidate(),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Bulk delete failed'))
    },
  })

  const isPending = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending

  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary-50 border border-primary-200 px-4 py-2">
      <span className="text-sm font-medium text-primary-700">{count} selected</span>

      <BulkDropdown
        label="Status"
        disabled={isPending}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] || s }))}
        onSelect={(v) => bulkUpdateMutation.mutate({ status: v })}
      />

      <BulkDropdown
        label="Priority"
        disabled={isPending}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] || p }))}
        onSelect={(v) => bulkUpdateMutation.mutate({ priority: v })}
      />

      <BulkDropdown
        label="Assignee"
        disabled={isPending}
        options={[
          { value: '__unassign__', label: 'Unassigned' },
          ...members.map((m) => ({ value: m.id, label: m.name })),
        ]}
        onSelect={(v) =>
          bulkUpdateMutation.mutate({ assigneeId: v === '__unassign__' ? null : v })
        }
      />

      <button
        onClick={() => {
          if (confirm(`Delete ${count} issue${count > 1 ? 's' : ''}?`)) {
            bulkDeleteMutation.mutate()
          }
        }}
        disabled={isPending}
        className="flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" /> Delete
      </button>

      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <X className="h-3 w-3" /> Cancel
      </button>
    </div>
  )
}

function BulkDropdown({
  label,
  options,
  onSelect,
  disabled,
}: {
  label: string
  options: { value: string; label: string }[]
  onSelect: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 disabled:opacity-50"
      >
        {label} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg dark:shadow-gray-900/50">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value)
                  setOpen(false)
                }}
                className="flex w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
