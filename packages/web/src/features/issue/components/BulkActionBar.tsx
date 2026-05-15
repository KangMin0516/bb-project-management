import { useMutation, useQueryClient } from '@tanstack/react-query'
import { issueRepository } from '@/features/issue/repository'
import {
  STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_DOT_COLORS,
} from '@/shared/config/constants'
import { X, Trash2, ChevronDown } from 'lucide-react'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '@/entities/user/UserAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface BulkActionMember {
  id: string
  name: string
  avatar?: string | null
}

interface BulkActionBarProps {
  projectId: string
  selectedIds: Set<string>
  members: BulkActionMember[]
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
      useToastStore.getState().addToast(getErrorMessage(err, 'Bulk update failed'), 'error')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () => issueRepository.bulkDelete(projectId, [...selectedIds]),
    onSuccess: () => invalidate(),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Bulk delete failed'), 'error')
    },
  })

  const isPending = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending

  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 px-4 py-2">
      <span className="text-sm font-medium text-primary-700 dark:text-primary-300">{count} selected</span>

      <BulkDropdown
        label="Status"
        disabled={isPending}
        options={STATUSES.map((s) => ({
          value: s,
          label: STATUS_LABELS[s] || s,
          leading: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_COLORS[s])} />,
        }))}
        onSelect={(v) => bulkUpdateMutation.mutate({ status: v })}
      />

      <BulkDropdown
        label="Priority"
        disabled={isPending}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p] || p,
          leading: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', PRIORITY_DOT_COLORS[p])} />,
        }))}
        onSelect={(v) => bulkUpdateMutation.mutate({ priority: v })}
      />

      <BulkDropdown
        label="Assignee"
        disabled={isPending}
        options={[
          {
            value: '__unassign__',
            label: 'Unassigned',
            leading: <UserAvatar user={null} size="sm" />,
          },
          ...members.map((m) => ({
            value: m.id,
            label: m.name,
            leading: <UserAvatar user={m} size="sm" />,
          })),
        ]}
        onSelect={(v) =>
          bulkUpdateMutation.mutate({ assigneeId: v === '__unassign__' ? null : v })
        }
      />

      <button
        onClick={async () => {
          if (await confirmDialog({
            title: `Delete ${count} issue${count > 1 ? 's' : ''}?`,
            confirmLabel: 'Delete',
            destructive: true,
          })) {
            bulkDeleteMutation.mutate()
          }
        }}
        disabled={isPending}
        className="flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
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

interface BulkDropdownOption {
  value: string
  label: string
  leading?: React.ReactNode
}

function BulkDropdown({
  label,
  options,
  onSelect,
  disabled,
}: {
  label: string
  options: BulkDropdownOption[]
  onSelect: (value: string) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition"
      >
        {label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onSelect(opt.value)}
            className="flex items-center gap-2 text-xs"
          >
            {opt.leading}
            <span className="truncate">{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
